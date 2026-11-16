import * as A from 'astronomy-engine'
import { NAKSHATRAS, SIGNS } from './data.js'
import { computeKundli, lahiriAyanamsa, siderealLongitude, tropicalLongitude, tzOffsetHours } from './engine.js'

const norm = (x: number): number => ((x % 360) + 360) % 360
const NAK = 360 / 27
const LUNAR_MONTHS = ['Chaitra', 'Vaishakha', 'Jyeshtha', 'Ashadha', 'Shravana', 'Bhadrapada', 'Ashwin', 'Kartika', 'Margashirsha', 'Pausha', 'Magha', 'Phalguna']

export const TITHI_NAMES = ['Pratipada', 'Dwitiya', 'Tritiya', 'Chaturthi', 'Panchami', 'Shashthi', 'Saptami', 'Ashtami', 'Navami', 'Dashami', 'Ekadashi', 'Dwadashi', 'Trayodashi', 'Chaturdashi']
export const YOGA_NAMES = ['Vishkambha', 'Priti', 'Ayushman', 'Saubhagya', 'Shobhana', 'Atiganda', 'Sukarma', 'Dhriti', 'Shula', 'Ganda', 'Vriddhi', 'Dhruva', 'Vyaghata', 'Harshana', 'Vajra', 'Siddhi', 'Vyatipata', 'Variyana', 'Parigha', 'Shiva', 'Siddha', 'Sadhya', 'Shubha', 'Shukla', 'Brahma', 'Indra', 'Vaidhriti']
const MOVABLE_KARANA = ['Bava', 'Balava', 'Kaulava', 'Taitila', 'Gara', 'Vanija', 'Vishti (Bhadra)']
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const WEEKDAY_LORDS = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn']

// Which eighth of the daytime (1 = first) each weekday's period falls in, Sunday first.
const RAHU = [8, 2, 7, 5, 6, 4, 3]
const YAMA = [5, 4, 3, 2, 1, 7, 6]
const GULIKA = [7, 6, 5, 4, 3, 2, 1]

// Planetary order used by horas and day choghadiya (Chaldean sequence).
const HORA_SEQ = ['Sun', 'Venus', 'Mercury', 'Moon', 'Saturn', 'Jupiter', 'Mars']
const CHOG_OF: Record<string, { name: string; nature: string }> = {
  Sun: { name: 'Udveg', nature: 'Inauspicious' }, Venus: { name: 'Chara', nature: 'Neutral' }, Mercury: { name: 'Labh', nature: 'Auspicious' },
  Moon: { name: 'Amrit', nature: 'Auspicious' }, Saturn: { name: 'Kaal', nature: 'Inauspicious' }, Jupiter: { name: 'Shubh', nature: 'Auspicious' }, Mars: { name: 'Rog', nature: 'Inauspicious' },
}
// Common western-Indian night sequence, indexed Sunday through Saturday.
// This is convention-dependent; keep it explicit instead of deriving it from day order.
const NIGHT_CHOGHADIYA = [
  ['Shubh', 'Amrit', 'Char', 'Rog', 'Kaal', 'Labh', 'Udveg', 'Shubh'],
  ['Char', 'Rog', 'Kaal', 'Labh', 'Udveg', 'Shubh', 'Amrit', 'Char'],
  ['Kaal', 'Labh', 'Udveg', 'Shubh', 'Amrit', 'Char', 'Rog', 'Kaal'],
  ['Udveg', 'Shubh', 'Amrit', 'Char', 'Rog', 'Kaal', 'Labh', 'Udveg'],
  ['Amrit', 'Char', 'Rog', 'Kaal', 'Labh', 'Udveg', 'Shubh', 'Amrit'],
  ['Rog', 'Kaal', 'Labh', 'Udveg', 'Shubh', 'Amrit', 'Char', 'Rog'],
  ['Labh', 'Udveg', 'Shubh', 'Amrit', 'Char', 'Rog', 'Kaal', 'Labh'],
]
const CHOG_BY_NAME = Object.fromEntries(Object.values(CHOG_OF).map(v => [v.name, v])) as Record<string, { name: string; nature: string }>

export interface Span { start: string; end: string }
export interface PanchangInput { date: string; latitude: number; longitude: number; timezone: string }

export const elongation = (d: Date): number => norm(tropicalLongitude('Moon', d) - tropicalLongitude('Sun', d))

/** First moment after `from` at which the integer index changes (searched in 20 minute steps, then bisected to one second). */
export function nextChange(index: (d: Date) => number, from: Date, maxHours = 60): Date {
  const i0 = index(from)
  let lo = from.getTime(), hi = lo
  const step = 20 * 60_000
  for (let t = lo + step; t <= from.getTime() + maxHours * 3600_000; t += step) {
    if (index(new Date(t)) !== i0) { hi = t; break }
    lo = t
  }
  if (hi === from.getTime()) return new Date(from.getTime() + maxHours * 3600_000)
  while (hi - lo > 1000) {
    const mid = Math.floor((lo + hi) / 2)
    if (index(new Date(mid)) === i0) lo = mid; else hi = mid
  }
  return new Date(hi)
}

const tithiIdx = (d: Date): number => Math.floor(elongation(d) / 12)
const karanaIdx = (d: Date): number => Math.floor(elongation(d) / 6)
const nakIdx = (d: Date): number => Math.floor(siderealLongitude('Moon', d) / NAK)
const yogaIdx = (d: Date): number => Math.floor(norm(siderealLongitude('Sun', d) + siderealLongitude('Moon', d)) / NAK)

/** Find the surrounding amavasya boundary by locating the 29 -> 0 tithi wrap. */
function newMoonBoundary(from: Date, direction: -1 | 1): Date {
  const step = 60 * 60_000
  let near = from.getTime()
  for (let i = 1; i <= 34 * 24; i++) {
    const far = from.getTime() + direction * i * step
    const farIndex = tithiIdx(new Date(far))
    const crossed = direction > 0
      ? tithiIdx(new Date(near)) === 29 && farIndex === 0
      : farIndex === 29 && tithiIdx(new Date(near)) === 0
    if (crossed) {
      let lo = Math.min(near, far), hi = Math.max(near, far)
      while (hi - lo > 1000) {
        const mid = Math.floor((lo + hi) / 2)
        if (tithiIdx(new Date(mid)) === 29) lo = mid; else hi = mid
      }
      return new Date(hi)
    }
    near = far
  }
  throw new Error('Could not find the surrounding new moon')
}

function amantaMonth(at: Date): { name: string; index: number; adhika: boolean } {
  const previous = newMoonBoundary(at, -1), next = newMoonBoundary(at, 1)
  const firstSign = Math.floor(siderealLongitude('Sun', previous) / 30)
  const lastSign = Math.floor(siderealLongitude('Sun', next) / 30)
  const ingressSign = firstSign === lastSign ? null : (lastSign + 12) % 12
  // The amanta month is named for the sidereal sign entered during it. With no
  // ingress, it is the intercalary repeat of the following named month.
  const index = ingressSign === null ? (firstSign + 1) % 12 : ingressSign
  return { name: LUNAR_MONTHS[index], index, adhika: ingressSign === null }
}

export function tithiInfo(i: number) {
  const n = i + 1
  const paksha = n <= 15 ? 'Shukla' : 'Krishna'
  const within = ((n - 1) % 15) + 1
  const name = within === 15 ? (n === 15 ? 'Purnima' : 'Amavasya') : TITHI_NAMES[within - 1]
  return { number: n, numberInPaksha: within, paksha, name: `${paksha} ${name}`, shortName: name }
}

export function karanaName(i: number): string {
  if (i === 0) return 'Kimstughna'
  if (i >= 57) return ['Shakuni', 'Chatushpada', 'Naga'][i - 57]
  return MOVABLE_KARANA[(i - 1) % 7]
}

const localHM = (d: Date, tz: string): string =>
  new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d)
const localYMD = (d: Date, tz: string): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)

export function computePanchang(inp: PanchangInput) {
  const { date, latitude, longitude, timezone: tz } = inp
  const off = tzOffsetHours(tz, date, '00:00')
  const midnight = new Date(Date.parse(`${date}T00:00:00Z`) - off * 3600_000) // local 00:00 as a UTC instant
  const obs = new A.Observer(latitude, longitude, 0)
  const rise = A.SearchRiseSet(A.Body.Sun, obs, +1, midnight, 1)
  const set = A.SearchRiseSet(A.Body.Sun, obs, -1, midnight, 1)
  if (!rise || !set || set.date <= rise.date) throw new Error('No sunrise or sunset on this date at this location')
  const sunrise = rise.date, sunset = set.date
  const nextRise = A.SearchRiseSet(A.Body.Sun, obs, +1, new Date(sunset.getTime() + 3600_000), 1)?.date ?? new Date(sunrise.getTime() + 86400_000)

  const tag = (d: Date): { iso: string; local: string } => {
    const day = localYMD(d, tz)
    return { iso: d.toISOString(), local: localHM(d, tz) + (day > date ? ' (next day)' : day < date ? ' (previous day)' : '') }
  }
  const span = (a: Date, b: Date) => ({ start: tag(a), end: tag(b) })

  const wd = new Date(`${date}T12:00:00Z`).getUTCDay() // weekday of the civil date
  const dayMs = sunset.getTime() - sunrise.getTime()
  const nightMs = nextRise.getTime() - sunset.getTime()
  const eighth = dayMs / 8
  const part = (n: number) => span(new Date(sunrise.getTime() + (n - 1) * eighth), new Date(sunrise.getTime() + n * eighth))

  const ti = tithiIdx(sunrise), ki = karanaIdx(sunrise), ni = nakIdx(sunrise), yi = yogaIdx(sunrise)
  const moonSid = siderealLongitude('Moon', sunrise), sunSid = siderealLongitude('Sun', sunrise)
  const pada = Math.floor((moonSid % NAK) / (NAK / 4)) + 1

  // Day choghadiya: eight equal parts starting with the weekday lord.
  const start = HORA_SEQ.indexOf(WEEKDAY_LORDS[wd])
  const choghadiya = Array.from({ length: 8 }, (_, i) => {
    const lord = HORA_SEQ[(start + i) % 7]
    return { ...CHOG_OF[lord], ...span(new Date(sunrise.getTime() + i * eighth), new Date(sunrise.getTime() + (i + 1) * eighth)) }
  })
  const nightEighth = nightMs / 8
  const nightChoghadiya = NIGHT_CHOGHADIYA[wd].map((name, i) => ({
    ...CHOG_BY_NAME[name],
    ...span(new Date(sunset.getTime() + i * nightEighth), new Date(sunset.getTime() + (i + 1) * nightEighth)),
  }))

  // Hora: 12 daytime and 12 night parts of unequal length; the sequence runs on through all 24.
  const hora = Array.from({ length: 24 }, (_, i) => {
    const day = i < 12
    const s = day ? sunrise.getTime() + (dayMs / 12) * i : sunset.getTime() + (nightMs / 12) * (i - 12)
    const e = day ? sunrise.getTime() + (dayMs / 12) * (i + 1) : sunset.getTime() + (nightMs / 12) * (i - 11)
    return { lord: HORA_SEQ[(start + i) % 7], period: day ? 'Day' : 'Night', ...span(new Date(s), new Date(e)) }
  })

  const moonrise = A.SearchRiseSet(A.Body.Moon, obs, +1, midnight, 1)?.date
  const moonset = A.SearchRiseSet(A.Body.Moon, obs, -1, midnight, 1)?.date
  const abhijitStart = new Date(sunrise.getTime() + (dayMs * 7) / 15)
  const abhijitEnd = new Date(sunrise.getTime() + (dayMs * 8) / 15)
  const brahmaStart = new Date(sunrise.getTime() - 96 * 60_000)
  const brahmaEnd = new Date(sunrise.getTime() - 48 * 60_000)

  const sunriseDate = localYMD(sunrise, tz), sunriseTime = localHM(sunrise, tz)
  const sunriseKundli = computeKundli({ date: sunriseDate, time: sunriseTime, tzOffset: tzOffsetHours(tz, sunriseDate, sunriseTime), lat: latitude, lon: longitude })
  const sunSignIndex = Math.floor(sunSid / 30)
  const ritu = ['Vasanta', 'Grishma', 'Varsha', 'Sharad', 'Hemanta', 'Shishira'][(sunSignIndex + 1) % 12 >> 1]
  const ayana = [9, 10, 11, 0, 1, 2].includes(sunSignIndex) ? 'Uttarayana' : 'Dakshinayana'

  const t = tithiInfo(ti)
  const lunarMonth = amantaMonth(sunrise)
  const civilYear = Number(date.slice(0, 4))
  const vikramSamvat = civilYear + (lunarMonth.index >= 9 ? 56 : 57)
  return {
    date, weekday: WEEKDAYS[wd], weekdayLord: WEEKDAY_LORDS[wd], timezone: tz,
    sunrise: tag(sunrise), sunset: tag(sunset), moonrise: moonrise ? tag(moonrise) : null, moonset: moonset ? tag(moonset) : null,
    dayLengthMinutes: Math.round(dayMs / 60_000),
    tithi: { ...t, endsAt: tag(nextChange(tithiIdx, sunrise)) },
    nakshatra: { name: NAKSHATRAS[ni], pada, endsAt: tag(nextChange(nakIdx, sunrise)) },
    yoga: { name: YOGA_NAMES[yi], endsAt: tag(nextChange(yogaIdx, sunrise)) },
    karana: { name: karanaName(ki), endsAt: tag(nextChange(karanaIdx, sunrise)) },
    sunSign: SIGNS[sunSignIndex], moonSign: SIGNS[Math.floor(moonSid / 30)], ritu, ayana,
    lunarMonth: { ...lunarMonth, system: 'Amanta (sunrise date; Lahiri sidereal ingress)' }, vikramSamvat: { year: vikramSamvat, system: 'Chaitradi Vikram Samvat estimate' },
    ayanamsa: lahiriAyanamsa(sunrise.getTime() / 86400_000 + 2440587.5),
    rahuKaal: part(RAHU[wd]), yamaganda: part(YAMA[wd]), gulika: part(GULIKA[wd]),
    abhijit: span(abhijitStart, abhijitEnd), brahmaMuhurat: span(brahmaStart, brahmaEnd),
    choghadiya, nightChoghadiya, hora,
    sunriseChart: {
      ascendant: { sign: sunriseKundli.ascendant.sign, signName: sunriseKundli.ascendant.signName },
      houses: sunriseKundli.houses,
      planets: sunriseKundli.planets.map(p => ({ name: p.name, sign: p.sign, signName: p.signName, degree: p.degree, house: p.house, retrograde: p.retrograde })),
    },
    notes: [
      'Tithi, nakshatra, yoga and karana are those running at sunrise; "ends at" shows when each changes.',
      'Rahu Kaal, Yamaganda and Gulika are one eighth of the daytime (sunrise to sunset). Abhijit is the 8th of 15 daytime parts.',
      'Brahma Muhurat uses the common fixed 48-minute window from 96 to 48 minutes before sunrise; definitions can vary. Ritu and ayana use the sidereal Sun-sign convention.',
      'Night Choghadiya follows the common weekday-specific sequence; Choghadiya tables vary by regional tradition.',
      'Lunar month uses the Amanta new-moon-to-new-moon system and sidereal solar ingress. Vikram Samvat uses the Chaitradi year convention; regional year starts differ.',
    ],
  }
}
