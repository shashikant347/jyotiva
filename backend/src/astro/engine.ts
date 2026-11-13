import * as A from 'astronomy-engine'
import { DASHA_ORDER, DASHA_YEARS, NAKSHATRAS, SIGNS } from './data.js'

export const PLANET_NAMES = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'] as const
export type PlanetName = (typeof PLANET_NAMES)[number]

const NAK_SPAN = 360 / 27
const norm = (x: number): number => ((x % 360) + 360) % 360
const rad = (d: number): number => (d * Math.PI) / 180
const deg = (r: number): number => (r * 180) / Math.PI
const BODY: Record<string, A.Body> = { Sun: A.Body.Sun, Moon: A.Body.Moon, Mars: A.Body.Mars, Mercury: A.Body.Mercury, Jupiter: A.Body.Jupiter, Venus: A.Body.Venus, Saturn: A.Body.Saturn }

export interface BirthInput {
  /** Local civil date and time at the birth place, e.g. 1990-05-17 and 14:30. */
  date: string
  time: string
  /** Hours east of UTC (India: 5.5). */
  tzOffset: number
  lat: number
  lon: number
}

export interface PlanetPos {
  name: PlanetName
  longitude: number // sidereal, 0..360
  sign: number // 0..11
  signName: string
  degree: number // within sign, 0..30
  nakshatra: number // 0..26
  nakshatraName: string
  pada: number // 1..4
  retrograde: boolean
  house: number // whole-sign house from lagna, 1..12
}

export interface Kundli {
  input: BirthInput
  utc: string
  julianDay: number
  ayanamsa: number
  ascendant: { longitude: number; sign: number; signName: string; degree: number; nakshatra: number; nakshatraName: string; pada: number }
  planets: PlanetPos[]
  houses: { house: number; sign: number; signName: string; planets: PlanetName[] }[]
}

export function toUtcDate(input: BirthInput): Date {
  const [y, mo, d] = input.date.split('-').map(Number)
  const [h, mi] = input.time.split(':').map(Number)
  return new Date(Date.UTC(y, mo - 1, d, h, mi) - input.tzOffset * 3600_000)
}

const julianDay = (d: Date): number => d.getTime() / 86400_000 + 2440587.5

/** Lahiri (Chitrapaksha) ayanamsa in degrees. Mean value, polynomial in Julian centuries from J2000. */
export function lahiriAyanamsa(jd: number): number {
  const T = (jd - 2451545.0) / 36525
  return 23.853056 + 1.396971 * T + 0.000309 * T * T
}

/** Tropical (true equinox of date) ecliptic longitude of a geocentric body. */
function tropicalLongitude(name: string, date: Date): number {
  const t = A.MakeTime(date)
  const vec = name === 'Moon' ? A.GeoMoon(t) : A.GeoVector(BODY[name], t, true)
  const ect = A.RotateVector(A.Rotation_EQJ_ECT(t), vec)
  return norm(deg(Math.atan2(ect.y, ect.x)))
}

/** Mean lunar node (Rahu), tropical. */
function meanNode(jd: number): number {
  const T = (jd - 2451545.0) / 36525
  return norm(125.0445479 - 1934.1362891 * T + 0.0020754 * T * T)
}

function siderealLongitude(name: PlanetName, date: Date): number {
  const jd = julianDay(date)
  const ay = lahiriAyanamsa(jd)
  if (name === 'Rahu') return norm(meanNode(jd) - ay)
  if (name === 'Ketu') return norm(meanNode(jd) + 180 - ay)
  return norm(tropicalLongitude(name, date) - ay)
}

function isRetrograde(name: PlanetName, date: Date): boolean {
  if (name === 'Sun' || name === 'Moon') return false
  if (name === 'Rahu' || name === 'Ketu') return true // mean node always moves backward
  const dt = 12 * 3600_000
  const a = siderealLongitude(name, new Date(date.getTime() - dt))
  const b = siderealLongitude(name, new Date(date.getTime() + dt))
  let diff = b - a
  if (diff > 180) diff -= 360
  if (diff < -180) diff += 360
  return diff < 0
}

/** Tropical ascendant from local sidereal time, latitude and obliquity (degrees). */
export function tropicalAscendant(jd: number, lat: number, lon: number): number {
  const T = (jd - 2451545.0) / 36525
  const gmst = norm(280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T * T - (T * T * T) / 38710000)
  const ramc = rad(norm(gmst + lon))
  const eps = rad(23.4392911 - 0.0130042 * T)
  const phi = rad(lat)
  return norm(deg(Math.atan2(Math.cos(ramc), -(Math.sin(ramc) * Math.cos(eps) + Math.tan(phi) * Math.sin(eps)))))
}

const place = (lon: number) => {
  const sign = Math.floor(lon / 30)
  const nakshatra = Math.floor(lon / NAK_SPAN)
  const pada = Math.floor((lon % NAK_SPAN) / (NAK_SPAN / 4)) + 1
  return { sign, signName: SIGNS[sign], degree: lon - sign * 30, nakshatra, nakshatraName: NAKSHATRAS[nakshatra], pada }
}

export function computeKundli(input: BirthInput): Kundli {
  const date = toUtcDate(input)
  const jd = julianDay(date)
  const ay = lahiriAyanamsa(jd)
  const ascLon = norm(tropicalAscendant(jd, input.lat, input.lon) - ay)
  const asc = place(ascLon)
  const planets: PlanetPos[] = PLANET_NAMES.map(name => {
    const longitude = siderealLongitude(name, date)
    const p = place(longitude)
    return { name, longitude, ...p, retrograde: isRetrograde(name, date), house: ((p.sign - asc.sign + 12) % 12) + 1 }
  })
  const houses = Array.from({ length: 12 }, (_, i) => {
    const sign = (asc.sign + i) % 12
    return { house: i + 1, sign, signName: SIGNS[sign], planets: planets.filter(p => p.sign === sign).map(p => p.name) }
  })
  return { input, utc: date.toISOString(), julianDay: jd, ayanamsa: ay, ascendant: { longitude: ascLon, ...asc }, planets, houses }
}

// ---------- Vimshottari dasha ----------
const YEAR_MS = 365.25 * 86400_000
export interface DashaPeriod { lord: string; start: string; end: string; sub?: DashaPeriod[] }

export function vimshottari(moonLon: number, birth: Date, levels: 1 | 2 = 2): DashaPeriod[] {
  const nak = Math.floor(moonLon / NAK_SPAN)
  const frac = (moonLon % NAK_SPAN) / NAK_SPAN
  const startIdx = nak % 9
  const out: DashaPeriod[] = []
  let cursor = birth.getTime()
  for (let k = 0; k < 9; k++) {
    const lord = DASHA_ORDER[(startIdx + k) % 9]
    const full = DASHA_YEARS[lord] * YEAR_MS
    const length = k === 0 ? full * (1 - frac) : full
    // For the first period the sub-periods start part-way through; build against the full period then clip.
    const mdStart = k === 0 ? cursor - full * frac : cursor
    const period: DashaPeriod = { lord, start: new Date(cursor).toISOString(), end: new Date(cursor + length).toISOString() }
    if (levels === 2) {
      const subs: DashaPeriod[] = []
      let sc = mdStart
      for (let j = 0; j < 9; j++) {
        const sl = DASHA_ORDER[(startIdx + k + j) % 9]
        const sLen = (full * DASHA_YEARS[sl]) / 120
        const s = Math.max(sc, cursor)
        const e = sc + sLen
        if (e > cursor + 1000) subs.push({ lord: sl, start: new Date(s).toISOString(), end: new Date(e).toISOString() })
        sc += sLen
      }
      period.sub = subs
    }
    out.push(period)
    cursor += length
  }
  return out
}

// ---------- Doshas ----------
export interface DoshaReport {
  mangal: { fromLagna: boolean; fromMoon: boolean; marsHouseFromLagna: number; marsHouseFromMoon: number; present: boolean; note: string }
  kaalSarp: { present: boolean; note: string }
  sadeSati: { active: boolean; phase: string | null; saturnSign: string; moonSign: string; asOf: string }
}

const MANGAL_HOUSES = new Set([1, 2, 4, 7, 8, 12])

export function doshas(k: Kundli, asOf: Date = new Date()): DoshaReport {
  const mars = k.planets.find(p => p.name === 'Mars')!
  const moon = k.planets.find(p => p.name === 'Moon')!
  const rahu = k.planets.find(p => p.name === 'Rahu')!
  const fromLagna = mars.house
  const fromMoon = ((mars.sign - moon.sign + 12) % 12) + 1
  const mFromLagna = MANGAL_HOUSES.has(fromLagna)
  const mFromMoon = MANGAL_HOUSES.has(fromMoon)

  // Kaal Sarp: all seven planets lie in the half of the zodiac from Rahu to Ketu (one side of the axis).
  const seven = k.planets.filter(p => !['Rahu', 'Ketu'].includes(p.name))
  const arc = (p: PlanetPos) => norm(p.longitude - rahu.longitude)
  const oneSide = seven.every(p => arc(p) < 180) || seven.every(p => arc(p) > 180)

  const sat = siderealLongitude('Saturn', asOf)
  const satSign = Math.floor(sat / 30)
  const rel = (satSign - moon.sign + 12) % 12
  const phase = rel === 11 ? 'Rising (first phase)' : rel === 0 ? 'Peak (second phase)' : rel === 1 ? 'Setting (third phase)' : null

  return {
    mangal: {
      fromLagna: mFromLagna, fromMoon: mFromMoon, marsHouseFromLagna: fromLagna, marsHouseFromMoon: fromMoon,
      present: mFromLagna || mFromMoon,
      note: 'Rule used: Mars in houses 1, 2, 4, 7, 8 or 12 from the Lagna or the Moon. Traditions differ on the 2nd house and on cancellations, which are not evaluated here.',
    },
    kaalSarp: { present: oneSide, note: 'All seven planets lie on one side of the Rahu-Ketu axis (mean node).' },
    sadeSati: { active: phase !== null, phase, saturnSign: SIGNS[satSign], moonSign: SIGNS[moon.sign], asOf: asOf.toISOString().slice(0, 10) },
  }
}

/** UTC offset in hours of an IANA time zone for a given local civil date and time (handles DST and historical changes). */
export function tzOffsetHours(tz: string, date: string, time: string): number {
  const [y, mo, d] = date.split('-').map(Number)
  const [h, mi] = time.split(':').map(Number)
  const localAsUtc = Date.UTC(y, mo - 1, d, h, mi)
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' })
  const offsetAt = (utcMs: number): number => {
    const p = Object.fromEntries(fmt.formatToParts(new Date(utcMs)).map(x => [x.type, Number(x.value)]))
    return (Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - utcMs) / 3600_000
  }
  let off = offsetAt(localAsUtc)
  off = offsetAt(localAsUtc - off * 3600_000)
  return off
}
