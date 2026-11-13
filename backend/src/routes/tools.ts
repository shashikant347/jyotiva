import { Router } from 'express'
import { z } from 'zod'
import { computeKundli, doshas, tzOffsetHours, vimshottari, type BirthInput, type Kundli } from '../astro/engine.js'
import { ashtakoota } from '../astro/matching.js'
import * as calc from '../astro/calculators.js'
import { searchPlaces } from '../astro/places.js'
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
    kundli,
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
}
toolsRouter.post('/calc/:slug', asyncHandler(async (req, res) => {
  const fn = Object.hasOwn(CALCS, req.params.slug) ? CALCS[req.params.slug] : undefined
  if (!fn) throw new HttpError(404, 'NOT_FOUND', 'Unknown calculator')
  try { ok(res, fn(req.body)) } catch (e) {
    if (e instanceof calc.CalcError) throw new HttpError(400, 'VALIDATION', e.message)
    throw e
  }
}))
