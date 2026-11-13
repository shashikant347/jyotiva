import * as A from 'astronomy-engine'

const letters = (s: string): string => s.toUpperCase().replace(/[^A-Z]/g, '')
const digitSum = (n: number): number => String(Math.abs(n)).split('').reduce((a, c) => a + Number(c), 0)
/** Reduce to a single digit 1-9 (0 stays 0). */
export const reduce = (n: number): number => { while (n > 9) n = digitSum(n); return n }

// Pythagorean: A=1 ... I=9, J=1 ... R=9, S=1 ... Z=8
const letterValue = (c: string): number => ((c.charCodeAt(0) - 65) % 9) + 1
export const nameTotal = (name: string): number => letters(name).split('').reduce((a, c) => a + letterValue(c), 0)

export function nameNumber(name: string) {
  const l = letters(name)
  if (!l) throw new CalcError('Enter a name using letters A to Z')
  const total = nameTotal(l)
  return { total, number: reduce(total) }
}

export class CalcError extends Error {}

const parseDate = (s: string): { y: number; m: number; d: number } => {
  const [y, m, d] = s.split('-').map(Number)
  return { y, m, d }
}

export function mulank(date: string) { const { d } = parseDate(date); return { dayOfBirth: d, mulank: reduce(d) } }
export function destiny(date: string) {
  const { y, m, d } = parseDate(date)
  const total = digitSum(y) + digitSum(m) + digitSum(d)
  return { total, destinyNumber: reduce(total) }
}
export function digitNumerology(digits: string) {
  const ds = digits.replace(/\D/g, '')
  if (ds.length < 3) throw new CalcError('Enter at least 3 digits')
  const total = ds.split('').reduce((a, c) => a + Number(c), 0)
  return { digits: ds, total, number: reduce(total) }
}

/** Lo Shu grid: digits of day, month and full year placed on the 3x3 magic square. */
export function loShu(date: string) {
  const { y, m, d } = parseDate(date)
  const digits = `${d}${m}${y}`.split('').map(Number).filter(n => n > 0)
  const counts: Record<number, number> = {}
  for (let i = 1; i <= 9; i++) counts[i] = 0
  for (const n of digits) counts[n]++
  const layout = [[4, 9, 2], [3, 5, 7], [8, 1, 6]]
  return {
    grid: layout.map(row => row.map(n => ({ n, count: counts[n] }))),
    missing: Object.keys(counts).map(Number).filter(n => counts[n] === 0),
    repeated: Object.keys(counts).map(Number).filter(n => counts[n] > 1),
    mulank: reduce(d), destiny: destiny(date).destinyNumber,
  }
}

/** FLAMES: cancel common letters, count the rest, eliminate round by round. */
export function flames(a: string, b: string) {
  const x = letters(a).split(''), y = letters(b).split('')
  if (!x.length || !y.length) throw new CalcError('Enter both names')
  for (let i = 0; i < x.length; i++) {
    const j = y.indexOf(x[i])
    if (j >= 0) { x[i] = ''; y.splice(j, 1) }
  }
  const remaining = x.filter(Boolean).length + y.length
  const names: Record<string, string> = { F: 'Friends', L: 'Love', A: 'Affection', M: 'Marriage', E: 'Enemies', S: 'Siblings' }
  if (remaining === 0) return { remaining, result: 'Friends', note: 'The names cancel out completely; Friends is used.' }
  let list = ['F', 'L', 'A', 'M', 'E', 'S'], idx = 0
  while (list.length > 1) {
    idx = (idx + remaining - 1) % list.length
    list.splice(idx, 1)
    if (idx >= list.length) idx = 0
  }
  return { remaining, result: names[list[0]], note: 'A traditional game; it has no astrological basis.' }
}

/** Traditional letter-count method ("TRUE LOVE"): count the letters of a keyword in both names, then add neighbours. */
function wordScore(a: string, b: string, word: string): number {
  const all = letters(a) + letters(b)
  if (!letters(a) || !letters(b)) throw new CalcError('Enter both names')
  let counts = word.split('').map(c => all.split('').filter(x => x === c).length)
  while (counts.length > 2) {
    const next: number[] = []
    for (let i = 0; i < counts.length - 1; i++) next.push(counts[i] + counts[i + 1])
    counts = next.flatMap(n => (n > 9 ? [Math.floor(n / 10), n % 10] : [n]))
    if (counts.length <= 2) break
  }
  const s = Number(counts.join('')) || 0
  return Math.min(s, 100)
}
export const love = (a: string, b: string) => ({ percent: wordScore(a, b, 'TRUELOVE'), note: 'For fun only. It counts letters in the two names and has no astrological basis.' })
export const friendship = (a: string, b: string) => ({ percent: wordScore(a, b, 'FRIENDS'), note: 'For fun only. It counts letters in the two names and has no astrological basis.' })

// Friendly number pairs from the common Pythagorean tradition are less standardised, so compare by simple harmony:
// same number, or numbers that differ by 3 or 6 (same triad group), count as harmonious.
export function nameCompatibility(a: string, b: string) {
  const na = nameNumber(a), nb = nameNumber(b)
  const diff = Math.abs(na.number - nb.number)
  const level = diff === 0 ? 'Same vibration' : diff % 3 === 0 ? 'Harmonious' : 'Neutral'
  return { first: na, second: nb, level, note: 'A light numerology comparison of the two name numbers; traditions differ.' }
}

export function age(dob: string, asOf: Date = new Date()) {
  const { y, m, d } = parseDate(dob)
  const ny = asOf.getUTCFullYear(), nm = asOf.getUTCMonth() + 1, nd = asOf.getUTCDate()
  const today = Date.UTC(ny, nm - 1, nd)
  if (today < Date.UTC(y, m - 1, d)) throw new CalcError('Date of birth is in the future')
  // Anniversary of the birth day N months later; a day that does not exist (e.g. 31 Feb) is clamped to month end.
  const anchor = (months: number): number => {
    const t = m - 1 + months
    const yy = y + Math.floor(t / 12), mm = ((t % 12) + 12) % 12
    return Date.UTC(yy, mm, Math.min(d, new Date(Date.UTC(yy, mm + 1, 0)).getUTCDate()))
  }
  let total = (ny - y) * 12 + (nm - m)
  if (anchor(total) > today) total--
  return { years: Math.floor(total / 12), months: total % 12, days: Math.round((today - anchor(total)) / 86400_000), totalDays: Math.round((today - Date.UTC(y, m - 1, d)) / 86400_000), asOf: asOf.toISOString().slice(0, 10) }
}

export function moonPhase(date: string) {
  const when = new Date(`${date}T12:00:00Z`)
  const angle = A.MoonPhase(when)
  const illum = A.Illumination(A.Body.Moon, when).phase_fraction
  const names = ['New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous', 'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent']
  const name = names[Math.floor(((angle + 22.5) % 360) / 45)]
  const tithiNo = Math.floor(angle / 12) + 1 // 1..30 from the Sun-Moon angle
  const paksha = tithiNo <= 15 ? 'Shukla (waxing)' : 'Krishna (waning)'
  const nextFull = A.SearchMoonPhase(180, when, 40)?.date.toISOString().slice(0, 10) ?? null
  const nextNew = A.SearchMoonPhase(0, when, 40)?.date.toISOString().slice(0, 10) ?? null
  return { date, phase: name, illuminationPercent: Math.round(illum * 100), angle: Math.round(angle * 10) / 10, tithiNumber: tithiNo, paksha, nextFullMoon: nextFull, nextNewMoon: nextNew, note: 'Computed for 12:00 UTC on that date.' }
}
