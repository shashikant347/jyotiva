import { Router } from 'express'
import { z } from 'zod'
import { SIGNS } from '../astro/data.js'
import { HttpError } from '../errors.js'
import { ok } from '../http.js'
import { getDb, type Horoscope } from '../store.js'

export const horoscopeRouter = Router()

const istToday = (): string => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
const query = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => !Number.isNaN(Date.parse(s)), 'Invalid date').optional(),
  lang: z.enum(['en', 'hi']).default('en'),
  category: z.enum(['general', 'love', 'career', 'finance', 'health']).default('general'),
})
const period = z.enum(['daily', 'weekly', 'monthly', 'yearly'])

const view = (h: Horoscope, requested: string) => ({
  sign: h.sign, signName: SIGNS[h.sign], period: h.period, category: h.category, language: h.language, languageFallback: h.language !== requested,
  dateFrom: h.dateFrom, dateTo: h.dateTo, text: h.text, isSample: !!h.isSample, luckyNumber: h.luckyNumber, luckyColor: h.luckyColor, mood: h.mood,
  scores: { love: h.loveScore, career: h.careerScore, health: h.healthScore, money: h.moneyScore },
})

/** The published entry covering `date`; the latest-starting one wins; falls back to English if the language is missing. */
function find(sign: number, p: string, category: string, lang: string, date: string): Horoscope | undefined {
  const pick = (l: string) => getDb().horoscopes
    .filter(h => h.status === 'published' && h.sign === sign && h.period === p && h.category === category && h.language === l && h.dateFrom <= date && date <= h.dateTo)
    .sort((a, b) => b.dateFrom.localeCompare(a.dateFrom))[0]
  return pick(lang) ?? (lang !== 'en' ? pick('en') : undefined)
}

horoscopeRouter.get('/:period', (req, res) => {
  const p = period.safeParse(req.params.period)
  if (!p.success) throw new HttpError(404, 'NOT_FOUND', 'Unknown horoscope period')
  const q = query.parse(req.query), date = q.date ?? istToday()
  const items = SIGNS.map((_, i) => find(i, p.data, q.category, q.lang, date)).filter((h): h is Horoscope => !!h).map(h => view(h, q.lang))
  res.set('Cache-Control', 'public, max-age=300')
  ok(res, { date, period: p.data, category: q.category, items })
})

horoscopeRouter.get('/:period/:sign', (req, res) => {
  const p = period.safeParse(req.params.period)
  const sign = SIGNS.findIndex(s => s.toLowerCase() === req.params.sign.toLowerCase())
  if (!p.success || sign < 0) throw new HttpError(404, 'NOT_FOUND', 'Unknown horoscope period or sign')
  const q = query.parse(req.query), date = q.date ?? istToday()
  const h = find(sign, p.data, q.category, q.lang, date)
  if (!h) throw new HttpError(404, 'NOT_PUBLISHED', 'This horoscope has not been published yet')
  res.set('Cache-Control', 'public, max-age=300')
  ok(res, { date, ...view(h, q.lang) })
})
