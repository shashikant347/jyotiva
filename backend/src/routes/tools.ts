import { Router } from 'express'
import { z } from 'zod'
import { computeKundli, doshas, tzOffsetHours, vimshottari, type BirthInput, type Kundli } from '../astro/engine.js'
import { ashtakoota } from '../astro/matching.js'
import * as calc from '../astro/calculators.js'
import * as extras from '../astro/extras.js'
import { divisionalCharts } from '../astro/divisional.js'
import { SIGNS } from '../astro/data.js'
import { computePanchang } from '../astro/panchang.js'
import { PLACES, searchPlaces } from '../astro/places.js'
import { HttpError } from '../errors.js'
import { asyncHandler, ok } from '../http.js'
import { toolsLimiter } from '../middleware/rateLimit.js'
import { birthDate, birthTime, timezone } from '../validators.js'

const birthBody = z.object({
  name: z.string().trim().max(80).optional(),
  birthDate,
  birthTime: birthTime.nullable().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  timezone: timezone.optional().default('Asia/Kolkata'),
}).strict()
type BirthBody = z.infer<typeof birthBody>

function build(b: BirthBody): { kundli: Kundli; timeUnknown: boolean } {
  const timeUnknown = !b.birthTime
  const time = b.birthTime ?? '12:00'
  const input: BirthInput = { date: b.birthDate, time, tzOffset: tzOffsetHours(b.timezone, b.birthDate, time), lat: b.latitude, lon: b.longitude }
  return { kundli: computeKundli(input), timeUnknown }
}

const kundliResponse = (b: BirthBody) => {
  const { kundli, timeUnknown } = build(b)
  const moon = kundli.planets.find(p => p.name === 'Moon')!
  return {
    name: b.name ?? null,
    timeUnknown,
    warnings: timeUnknown ? ['Birth time was not given, so noon was used. The ascendant, houses and divisional details are not reliable; Moon-based results are usually still fine.'] : [],
    kundli: { ...kundli, divisionalCharts: divisionalCharts(kundli) },
    moon: { sign: moon.sign, signName: moon.signName, nakshatra: moon.nakshatra, nakshatraName: moon.nakshatraName, pada: moon.pada },
    dasha: vimshottari(moon.longitude, new Date(kundli.utc)),
    doshas: doshas(kundli),
    method: { zodiac: 'Sidereal (Lahiri ayanamsa)', houses: 'Whole sign', nodes: 'Mean node', ephemeris: 'astronomy-engine (VSOP87 / ELP-based)' },
  }
}

export const toolsRouter = Router()
toolsRouter.use(toolsLimiter)

toolsRouter.get('/places', (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.slice(0, 60) : ''
  ok(res, { places: searchPlaces(q).map(p => ({ name: p.name, state: p.state, latitude: p.lat, longitude: p.lon, timezone: 'Asia/Kolkata' })) })
})

toolsRouter.get('/cities', (_req, res) => {
  ok(res, { cities: PLACES.map(p => ({ name: p.name, state: p.state, slug: p.name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), latitude: p.lat, longitude: p.lon, timezone: 'Asia/Kolkata' })) })
})

toolsRouter.post('/kundli', asyncHandler(async (req, res) => {
  ok(res, kundliResponse(birthBody.parse(req.body)))
}))

toolsRouter.post('/matching', asyncHandler(async (req, res) => {
  const { bride, groom } = z.object({ bride: birthBody, groom: birthBody }).strict().parse(req.body)
  const b = kundliResponse(bride), g = kundliResponse(groom)
  const result = ashtakoota(b.moon, g.moon)
  const warnings = [...b.warnings.map(w => 'Bride: ' + w), ...g.warnings.map(w => 'Groom: ' + w)]
  ok(res, {
    bride: { name: bride.name ?? null, moonSign: b.moon.signName, nakshatra: b.moon.nakshatraName, pada: b.moon.pada, mangal: b.doshas.mangal.present },
    groom: { name: groom.name ?? null, moonSign: g.moon.signName, nakshatra: g.moon.nakshatraName, pada: g.moon.pada, mangal: g.doshas.mangal.present },
    ...result,
    warnings,
  })
}))

const signEnum = z.enum(SIGNS)
toolsRouter.get('/compatibility/:a/:b', asyncHandler(async (req, res) => {
  const a = signEnum.parse(req.params.a)
  const b = signEnum.parse(req.params.b)
  ok(res, extras.compatibility(a, b))
}))

toolsRouter.post('/tarot/draw', asyncHandler(async (req, res) => {
  const { spread } = z.object({ spread: z.enum(['single', 'three', '3-card', 'love', 'career', 'finance']) }).strict().parse(req.body)
  ok(res, extras.tarot(spread))
}))

// ---- Simple calculators (numerology and fun tools) ----
const nm = z.string().trim().min(1, 'Enter a name').max(60)
const dt = z.object({ date: birthDate }).strict()
const two = z.object({ first: nm, second: nm }).strict()
const CALCS: Record<string, (body: unknown) => unknown> = {
  'love-calculator': b => { const v = two.parse(b); return calc.love(v.first, v.second) },
  'flames-calculator': b => { const v = two.parse(b); return calc.flames(v.first, v.second) },
  'friendship-calculator': b => { const v = two.parse(b); return calc.friendship(v.first, v.second) },
  'name-compatibility-calculator': b => { const v = two.parse(b); return calc.nameCompatibility(v.first, v.second) },
  'name-numerology-calculator': b => calc.nameNumber(z.object({ name: nm }).strict().parse(b).name),
  'mulank-calculator': b => calc.mulank(dt.parse(b).date),
  'destiny-number-calculator': b => calc.destiny(dt.parse(b).date),
  'mobile-number-numerology-calculator': b => calc.digitNumerology(z.object({ number: z.string().trim().min(3).max(20) }).strict().parse(b).number),
  'lucky-vehicle-number-calculator': b => calc.digitNumerology(z.object({ number: z.string().trim().min(3).max(20) }).strict().parse(b).number),
  'lo-shu-grid-calculator': b => calc.loShu(dt.parse(b).date),
  'age-calculator': b => calc.age(dt.parse(b).date),
  'moon-phase-calculator': b => calc.moonPhase(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => !Number.isNaN(Date.parse(s)) && s >= '1900-01-01' && s <= '2100-12-31', 'Choose a date between 1900 and 2100') }).strict().parse(b).date),
  'lucky-name-numerology-calculator': b => calc.nameNumber(z.object({ name: nm }).strict().parse(b).name),
  'sun-sign-calculator': b => calc.birthSummary(birthBody.parse(b), 'sun'),
  'rising-ascendant-sign-calculator': b => calc.birthSummary(birthBody.parse(b), 'ascendant'),
  'rashi-moon-sign-calculator': b => calc.birthSummary(birthBody.parse(b), 'moon'),
  'nakshatra-birth-star-calculator': b => calc.birthSummary(birthBody.parse(b), 'nakshatra'),
  'dasha-calculator': b => calc.birthSummary(birthBody.parse(b), 'dasha'),
  'birth-natal-chart-calculator': b => calc.birthSummary(birthBody.parse(b), 'chart'),
  'atmakaraka-and-darakaraka-calculator': b => calc.birthSummary(birthBody.parse(b), 'karaka'),
  'ishta-devata-calculator': b => calc.birthSummary(birthBody.parse(b), 'ishta'),
  'mangal-dosha-calculator': b => calc.birthSummary(birthBody.parse(b), 'mangal'),
  'shani-sade-sati-calculator': b => calc.birthSummary(birthBody.parse(b), 'sade-sati'),
  'kaal-sarp-dosh-calculator': b => calc.birthSummary(birthBody.parse(b), 'kaal-sarp'),
  'transit-chart-calculator': b => {
    const v = z.object({ birth: birthBody, transitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => !Number.isNaN(Date.parse(s)) && s >= '1900-01-01' && s <= '2100-12-31') }).strict().parse(b)
    return calc.transitChart(v.birth, v.transitDate)
  },
}
toolsRouter.post('/calc/:slug', asyncHandler(async (req, res) => {
  const fn = Object.hasOwn(CALCS, req.params.slug) ? CALCS[req.params.slug] : undefined
  if (!fn) throw new HttpError(404, 'NOT_FOUND', 'Unknown calculator')
  try { ok(res, fn(req.body)) } catch (e) {
    if (e instanceof calc.CalcError) throw new HttpError(400, 'VALIDATION', e.message)
    throw e
  }
}))

// ---- Panchang (cached: the result depends only on date and place) ----
const panchangBody = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD').refine(s => !Number.isNaN(Date.parse(s)) && s >= '1900-01-01' && s <= '2100-12-31', 'Choose a date between 1900 and 2100'),
  latitude: z.number().min(-66).max(66),
  longitude: z.number().min(-180).max(180),
  timezone: timezone.optional().default('Asia/Kolkata'),
}).strict()
const panchangCache = new Map<string, { at: number; value: unknown }>()
toolsRouter.post('/panchang', asyncHandler(async (req, res) => {
  const b = panchangBody.parse(req.body)
  const key = `${b.date}|${b.latitude.toFixed(2)}|${b.longitude.toFixed(2)}|${b.timezone}`
  const hit = panchangCache.get(key)
  if (hit && Date.now() - hit.at < 24 * 3600_000) { ok(res, hit.value); return }
  let value: unknown
  try { value = computePanchang(b) } catch (e) { throw new HttpError(400, 'VALIDATION', (e as Error).message) }
  if (panchangCache.size > 2000) panchangCache.delete(panchangCache.keys().next().value as string)
  panchangCache.set(key, { at: Date.now(), value })
  ok(res, value)
}))

toolsRouter.post('/muhurat/search', asyncHandler(async (req, res) => {
  const b = z.object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => !Number.isNaN(Date.parse(s)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => !Number.isNaN(Date.parse(s)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s),
    latitude: z.number().min(-66).max(66), longitude: z.number().min(-180).max(180), timezone: timezone,
  }).strict().parse(req.body)
  const first = Date.parse(`${b.from}T00:00:00Z`), last = Date.parse(`${b.to}T00:00:00Z`), days = Math.round((last - first) / 86400_000) + 1
  if (days < 1 || days > 31) throw new HttpError(400, 'VALIDATION', 'Choose a date range of 1 to 31 days')
  const tag = (iso: string) => ({ iso, local: new Intl.DateTimeFormat('en-GB', { timeZone: b.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso)) })
  const results = []
  for (let i = 0; i < days; i++) {
    const date = new Date(first + i * 86400_000).toISOString().slice(0, 10)
    const p = computePanchang({ date, latitude: b.latitude, longitude: b.longitude, timezone: b.timezone })
    const sunrise = Date.parse(p.sunrise.iso), sunset = Date.parse(p.sunset.iso)
    let windows: { start: number; end: number }[] = [{ start: sunrise, end: sunset }]
    const excluded = [p.rahuKaal, p.yamaganda, p.gulika].map(x => ({ start: Date.parse(x.start.iso), end: Date.parse(x.end.iso) }))
    for (const block of excluded) windows = windows.flatMap(w => block.end <= w.start || block.start >= w.end ? [w] : [
      ...(block.start > w.start ? [{ start: w.start, end: block.start }] : []),
      ...(block.end < w.end ? [{ start: block.end, end: w.end }] : []),
    ])
    results.push({ date, weekday: p.weekday, windows: windows.filter(w => w.end - w.start >= 10 * 60_000).map(w => ({ start: tag(new Date(w.start).toISOString()), end: tag(new Date(w.end).toISOString()) })) })
  }
  ok(res, { results, method: 'Daylight intervals after excluding Rahu Kaal, Yamaganda and Gulika Kaal only.', note: 'These are screening windows, not a complete muhurta calculation. Ceremony-specific tithi, nakshatra, yoga, lagna, regional rules and personal charts are not evaluated. Confirm dates with a trusted local almanac or priest.' })
}))
