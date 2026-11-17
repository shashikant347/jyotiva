import { computeKundli, doshas, tzOffsetHours, vimshottari, type BirthInput } from './engine.js'

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

function birthInput(b: { birthDate: string; birthTime?: string | null; latitude: number; longitude: number; timezone: string }): BirthInput {
  const time = b.birthTime ?? '12:00'
  return { date: b.birthDate, time, tzOffset: tzOffsetHours(b.timezone, b.birthDate, time), lat: b.latitude, lon: b.longitude }
}

/** Shared calculations for the retained birth-detail tools. */
export function birthSummary(b: { birthDate: string; birthTime?: string | null; latitude: number; longitude: number; timezone: string }, kind: string) {
  const k = computeKundli(birthInput(b))
  const moon = k.planets.find(p => p.name === 'Moon')!
  const warning = b.birthTime ? [] : ['Birth time is unknown; noon was used. Ascendant and house-based results may be unreliable.']
  if (kind === 'sun') {
    const sun = k.planets.find(p => p.name === 'Sun')!
    return { sign: sun.signName, longitude: sun.longitude, system: 'Sidereal (Lahiri)', warnings: warning }
  }
  if (kind === 'ascendant') return { sign: k.ascendant.signName, degree: k.ascendant.degree, system: 'Sidereal (Lahiri)', warnings: warning }
  if (kind === 'moon') return { sign: moon.signName, degree: moon.degree, system: 'Sidereal (Lahiri)', warnings: warning }
  if (kind === 'nakshatra') return { nakshatra: moon.nakshatraName, pada: moon.pada, moonSign: moon.signName, warnings: warning }
  if (kind === 'dasha') return { periods: vimshottari(moon.longitude, new Date(k.utc)), warnings: warning }
  const report = doshas(k)
  if (kind === 'mangal') return { ...report.mangal, warnings: warning }
  if (kind === 'sade-sati') return { ...report.sadeSati, warnings: warning }
  if (kind === 'karaka') {
    const seven = k.planets.filter(p => ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'].includes(p.name)).sort((x, y) => y.degree - x.degree)
    const atma = seven[0], dara = seven[6]
    return { atmakaraka: { planet: atma.name, sign: atma.signName, degree: atma.degree }, darakaraka: { planet: dara.name, sign: dara.signName, degree: dara.degree }, method: 'Seven classical planets ranked by degrees within their signs; traditions may differ.', warnings: warning }
  }
  throw new CalcError('Unknown birth calculation')
}

/** Traditional letter-count method ("TRUE LOVE"): count keyword letters, then add neighbours. */
function wordScore(a: string, b: string): number {
  const all = letters(a) + letters(b)
  if (!letters(a) || !letters(b)) throw new CalcError('Enter both names')
  let counts = 'TRUELOVE'.split('').map(c => all.split('').filter(x => x === c).length)
  while (counts.length > 2) {
    const next: number[] = []
    for (let i = 0; i < counts.length - 1; i++) {
      const sum = counts[i] + counts[i + 1]
      if (sum > 9) next.push(Math.floor(sum / 10), sum % 10)
      else next.push(sum)
      if (next.length > 1024) throw new CalcError('These names are too repetitive to calculate a score')
    }
    counts = next
  }
  return Math.min(Number(counts.join('')) || 0, 100)
}
export const love = (a: string, b: string) => ({ percent: wordScore(a, b), note: 'For fun only. It counts letters in the two names and has no astrological basis.' })
