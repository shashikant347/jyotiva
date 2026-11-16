import { z } from 'zod'
import { SIGNS } from '../astro/data.js'
import type { Horoscope, HoroscopeCategory, HoroscopePeriod } from '../store.js'
import { parseCsv } from './csv.js'

export const COLUMNS = ['sign', 'period', 'category', 'language', 'date_from', 'date_to', 'text', 'lucky_number', 'lucky_color', 'mood', 'love_score', 'career_score', 'health_score', 'money_score'] as const
export const MAX_ROWS = 2000
const MAX_SPAN: Record<HoroscopePeriod, number> = { daily: 1, weekly: 7, monthly: 31, yearly: 366 }

const day = (s: string): number => Date.parse(s + 'T00:00:00Z')
const iso = (ms: number): string => new Date(ms).toISOString().slice(0, 10)
const validDate = (s: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(day(s)) && iso(day(s)) === s && s >= '2000-01-01' && s <= '2100-12-31'

/** Default end date when date_to is left blank. */
export function defaultDateTo(period: HoroscopePeriod, from: string): string {
  const d = new Date(day(from))
  if (period === 'daily') return from
  if (period === 'weekly') return iso(day(from) + 6 * 86400_000)
  if (period === 'monthly') return iso(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))
  return `${d.getUTCFullYear()}-12-31`
}

const optInt = (name: string, min: number, max: number) =>
  z.string().trim().transform((v, ctx) => {
    if (v === '') return null
    const n = Number(v)
    if (!Number.isInteger(n) || n < min || n > max) { ctx.addIssue({ code: 'custom', message: `${name} must be a whole number from ${min} to ${max}` }); return z.NEVER }
    return n
  })
const optText = (name: string, max: number) =>
  z.string().trim().transform((v, ctx) => {
    if (v.length > max) { ctx.addIssue({ code: 'custom', message: `${name} is longer than ${max} characters` }); return z.NEVER }
    return v === '' ? null : v
  })

const rowSchema = z.object({
  sign: z.string().trim().transform((v, ctx) => {
    const i = SIGNS.findIndex(s => s.toLowerCase() === v.toLowerCase())
    if (i < 0) { ctx.addIssue({ code: 'custom', message: `Unknown sign "${v}"` }); return z.NEVER }
    return i
  }),
  period: z.string().trim().toLowerCase().pipe(z.enum(['daily', 'weekly', 'monthly', 'yearly'], { message: 'period must be daily, weekly, monthly or yearly' })),
  category: z.string().trim().toLowerCase().transform(v => v || 'general').pipe(z.enum(['general', 'love', 'career', 'finance', 'health'], { message: 'category must be general, love, career, finance or health' })),
  language: z.string().trim().toLowerCase().transform(v => v || 'en').pipe(z.enum(['en', 'hi'], { message: 'language must be en or hi' })),
  date_from: z.string().trim().refine(validDate, 'date_from must be a real date as YYYY-MM-DD (2000 to 2100)'),
  date_to: z.string().trim(),
  text: z.string().trim().min(1, 'text is empty').max(4000, 'text is longer than 4000 characters'),
  lucky_number: optInt('lucky_number', 0, 99), lucky_color: optText('lucky_color', 30), mood: optText('mood', 30),
  love_score: optInt('love_score', 1, 5), career_score: optInt('career_score', 1, 5), health_score: optInt('health_score', 1, 5), money_score: optInt('money_score', 1, 5),
})

export interface ImportError { row: number; message: string }
export interface Parsed { rows: Omit<Horoscope, 'id' | 'createdAt' | 'updatedAt' | 'status'>[]; errors: ImportError[] }

export function parseHoroscopeCsv(csv: string): Parsed {
  const table = parseCsv(csv)
  if (table.length === 0) return { rows: [], errors: [{ row: 1, message: 'The file is empty' }] }
  const header = table[0].map(h => h.trim().toLowerCase())
  const missing = ['sign', 'period', 'date_from', 'text'].filter(c => !header.includes(c))
  if (missing.length) return { rows: [], errors: [{ row: 1, message: `Missing column(s): ${missing.join(', ')}` }] }
  const unknown = header.filter(h => !(COLUMNS as readonly string[]).includes(h))
  if (unknown.length) return { rows: [], errors: [{ row: 1, message: `Unknown column(s): ${unknown.join(', ')}` }] }
  if (table.length - 1 > MAX_ROWS) return { rows: [], errors: [{ row: 1, message: `Too many rows (maximum ${MAX_ROWS} per import)` }] }

  const rows: Parsed['rows'] = [], errors: ImportError[] = []
  const seen = new Set<string>()
  table.slice(1).forEach((cells, idx) => {
    const rowNo = idx + 2
    const raw: Record<string, string> = {}
    for (const c of COLUMNS) { const k = header.indexOf(c); raw[c] = k >= 0 ? (cells[k] ?? '') : '' }
    const r = rowSchema.safeParse(raw)
    if (!r.success) { errors.push({ row: rowNo, message: r.error.issues[0].message }); return }
    const v = r.data
    const dateTo = v.date_to === '' ? defaultDateTo(v.period, v.date_from) : v.date_to
    if (!validDate(dateTo) || dateTo < v.date_from) { errors.push({ row: rowNo, message: 'date_to must be a real date on or after date_from' }); return }
    const span = (day(dateTo) - day(v.date_from)) / 86400_000 + 1
    if (span > MAX_SPAN[v.period]) { errors.push({ row: rowNo, message: `A ${v.period} horoscope can cover at most ${MAX_SPAN[v.period]} day(s); this covers ${span}` }); return }
    const key = [v.sign, v.period, v.category, v.language, v.date_from].join('|')
    if (seen.has(key)) { errors.push({ row: rowNo, message: 'Duplicate of an earlier row (same sign, period, category, language and date_from)' }); return }
    seen.add(key)
    rows.push({
      sign: v.sign, period: v.period as HoroscopePeriod, category: v.category as HoroscopeCategory, language: v.language, dateFrom: v.date_from, dateTo,
      text: v.text, luckyNumber: v.lucky_number, luckyColor: v.lucky_color, mood: v.mood,
      loveScore: v.love_score, careerScore: v.career_score, healthScore: v.health_score, moneyScore: v.money_score,
    })
  })
  return { rows, errors }
}

export const TEMPLATE_CSV = COLUMNS.join(',') + '\n' +
  'Aries,daily,general,en,2026-11-17,,"Write your own original text here.",7,Red,Energetic,4,3,4,5\n'
