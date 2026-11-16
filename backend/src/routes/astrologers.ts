import { Router, raw } from 'express'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { config } from '../config.js'
import { CATEGORY_LIST, CATEGORY_SLUGS, LANGUAGE_CODES, LANGUAGE_LIST, MAX_PRICE_RUPEES, MIN_PRICE_RUPEES, SKILL_LIST, SKILL_SLUGS, slugify } from '../astrologers/data.js'
import { HttpError } from '../errors.js'
import { asyncHandler, ok } from '../http.js'
import { currentUser, requireAuth } from '../middleware/auth.js'
import { hasOpenSession } from '../sessions/service.js'
import { applyLimiter } from '../middleware/rateLimit.js'
import { getDb, newId, save, type Astrologer } from '../store.js'
import { timezone } from '../validators.js'
import { createAvailabilityWatch, getAvailabilityWatch, isAstrologerAvailable, notifyAvailability, removeAvailabilityWatch } from '../notifications/service.js'
import { isAstrologerLive } from '../astrologers/presence.js'

export const astrologersRouter = Router()

const mediaDir = path.resolve(path.dirname(path.resolve(config.dataFile)), 'media', 'astrologers')
const imageTypes = new Map([
  ['image/jpeg', { ext: 'jpg', signature: (b: Buffer) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff }],
  ['image/png', { ext: 'png', signature: (b: Buffer) => b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) }],
  ['image/webp', { ext: 'webp', signature: (b: Buffer) => b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' }],
])

astrologersRouter.get('/media/:filename', asyncHandler(async (req, res) => {
  const filename = req.params.filename
  if (!/^[a-f0-9-]{36}\.(jpg|png|webp)$/.test(filename)) throw new HttpError(404, 'NOT_FOUND', 'Photo not found')
  const type = filename.endsWith('.jpg') ? 'image/jpeg' : filename.endsWith('.png') ? 'image/png' : 'image/webp'
  try {
    const image = await fs.readFile(path.join(mediaDir, filename))
    res.set({ 'Content-Type': type, 'Content-Length': String(image.length), 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' })
    res.send(image)
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') throw new HttpError(404, 'NOT_FOUND', 'Photo not found')
    throw e
  }
}))

const approved = (): Astrologer[] => getDb().astrologers.filter(a => a.status === 'approved')
const stats = (a: Astrologer) => {
  const r = getDb().reviews.filter(x => x.astrologerId === a.id && x.isVisible)
  return { ratingCount: r.length, ratingAvg: r.length ? Math.round((r.reduce((s, x) => s + x.rating, 0) / r.length) * 10) / 10 : null }
}
export const publicAstrologer = (a: Astrologer) => ({
  slug: a.slug, displayName: a.displayName, bio: a.bio, experienceYears: a.experienceYears, gender: a.gender,
  photoUrl: a.photoUrl ?? null,
  languages: a.languages, categories: a.categories, skills: a.skills,
  chatPricePaise: a.chatPricePaise, callPricePaise: a.callPricePaise,
  status: isAstrologerLive(a) ? (a.isBusy ? 'busy' : 'online') : 'offline', badge: a.badge, isDemo: a.isDemo, availability: a.availability ?? null, ...stats(a),
})

astrologersRouter.get('/categories', (_req, res) => {
  ok(res, { categories: CATEGORY_LIST, skills: SKILL_LIST, languages: LANGUAGE_LIST, priceLimits: { minRupees: MIN_PRICE_RUPEES, maxRupees: MAX_PRICE_RUPEES } })
})

const listQuery = z.object({
  category: z.string().max(40).optional(), skill: z.string().max(40).optional(), language: z.string().max(5).optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  minExperience: z.coerce.number().int().min(0).max(80).optional(), maxPrice: z.coerce.number().min(0).max(100000).optional(), // paise
  mode: z.enum(['chat', 'call']).default('chat'),
  online: z.enum(['true', 'false']).optional(), q: z.string().trim().max(60).optional(),
  sort: z.enum(['popular', 'rating', 'price-low', 'price-high', 'experience']).default('popular'),
  page: z.coerce.number().int().min(1).max(1000).default(1), limit: z.coerce.number().int().min(1).max(50).default(12),
})

astrologersRouter.get('/', (req, res) => {
  const q = listQuery.parse(req.query)
  const price = (a: Astrologer) => (q.mode === 'call' ? a.callPricePaise : a.chatPricePaise)
  const rating = (a: Astrologer) => stats(a).ratingAvg ?? -1
  let list = approved().filter(a =>
    (!q.category || a.categories.includes(q.category)) && (!q.skill || a.skills.includes(q.skill)) && (!q.language || a.languages.includes(q.language)) &&
    (!q.gender || a.gender === q.gender) && (q.minExperience === undefined || a.experienceYears >= q.minExperience) &&
    (q.maxPrice === undefined || price(a) <= q.maxPrice) && (q.online !== 'true' || (isAstrologerLive(a) && !a.isBusy)) &&
    (!q.q || a.displayName.toLowerCase().includes(q.q.toLowerCase())))
  const by: Record<typeof q.sort, (a: Astrologer, b: Astrologer) => number> = {
    // Real order counts do not exist yet, so "popular" = online first, then rating, then experience.
    popular: (a, b) => Number(isAstrologerLive(b)) - Number(isAstrologerLive(a)) || rating(b) - rating(a) || b.experienceYears - a.experienceYears,
    rating: (a, b) => rating(b) - rating(a) || b.experienceYears - a.experienceYears,
    'price-low': (a, b) => price(a) - price(b), 'price-high': (a, b) => price(b) - price(a),
    experience: (a, b) => b.experienceYears - a.experienceYears,
  }
  list = list.sort((a, b) => by[q.sort](a, b) || a.displayName.localeCompare(b.displayName))
  const total = list.length
  res.set('Cache-Control', 'no-store')
  ok(res, { total, page: q.page, limit: q.limit, items: list.slice((q.page - 1) * q.limit, q.page * q.limit).map(publicAstrologer) })
})

// ---- the signed-in user's own astrologer application / status (registered before /:slug) ----
const applyBody = z.object({
  displayName: z.string().trim().min(2).max(60),
  bio: z.string().trim().min(20, 'Write at least 20 characters about yourself').max(1000),
  experienceYears: z.number().int().min(0).max(70),
  gender: z.enum(['male', 'female', 'other']),
  languages: z.array(z.enum(LANGUAGE_CODES as [string, ...string[]])).min(1).max(6),
  categories: z.array(z.enum(CATEGORY_SLUGS as [string, ...string[]])).min(1).max(6),
  skills: z.array(z.enum(SKILL_SLUGS as [string, ...string[]])).min(1).max(5),
  chatPriceRupees: z.number().int().min(MIN_PRICE_RUPEES).max(MAX_PRICE_RUPEES),
  callPriceRupees: z.number().int().min(MIN_PRICE_RUPEES).max(MAX_PRICE_RUPEES),
}).strict()

const own = (userId: string) => getDb().astrologers.find(a => a.userId === userId)
const approvedOwn = (userId: string) => {
  const a = own(userId)
  if (!a || a.status !== 'approved') throw new HttpError(403, 'FORBIDDEN', 'Only approved astrologers can access payouts')
  return a
}
const totalEarnings = (astrologerId: string) => getDb().sessions
  .filter(s => s.astrologerId === astrologerId && s.status === 'ended')
  .reduce((sum, s) => sum + s.astrologerEarningPaise - Math.min(s.refundedPaise, s.astrologerEarningPaise), 0)
const ownView = (a: Astrologer) => ({
  ...publicAstrologer(a),
  // The panel displays the astrologer's saved online preference; public
  // availability is separately gated by the live Socket.IO connection.
  status: a.isOnline ? (a.isBusy ? 'busy' : 'online') : 'offline',
  applicationStatus: a.status,
})

astrologersRouter.get('/me/profile', requireAuth, (_req, res) => {
  const a = own(currentUser(res).id)
  ok(res, { application: a ? ownView(a) : null })
})

astrologersRouter.put('/me/photo', requireAuth, raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '5mb' }), asyncHandler(async (req, res) => {
  const a = own(currentUser(res).id)
  if (!a || a.status !== 'approved') throw new HttpError(403, 'FORBIDDEN', 'Only approved astrologers can update their profile photo')
  const image = req.body
  const type = typeof req.headers['content-type'] === 'string' ? req.headers['content-type'].split(';')[0].trim().toLowerCase() : ''
  const format = imageTypes.get(type)
  if (!Buffer.isBuffer(image) || image.length === 0) throw new HttpError(400, 'VALIDATION', 'Upload a JPEG, PNG or WebP image')
  if (image.length > 5 * 1024 * 1024) throw new HttpError(413, 'TOO_LARGE', 'Profile photos must be 5 MB or smaller')
  if (!format || !format.signature(image)) throw new HttpError(400, 'VALIDATION', 'The image content does not match its file type')
  await fs.mkdir(mediaDir, { recursive: true })
  const filename = `${randomUUID()}.${format.ext}`
  await fs.writeFile(path.join(mediaDir, filename), image, { flag: 'wx' })
  a.photoUrl = `/api/v1/astrologers/media/${filename}`
  a.updatedAt = new Date().toISOString()
  save()
  ok(res, { application: ownView(a) })
}))

const availabilityBody = z.object({
  timezone,
  weekly: z.array(z.object({
    day: z.number().int().min(0).max(6),
    start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  }).strict()).max(21),
}).strict().superRefine((v, ctx) => {
  for (const slot of v.weekly) if (slot.start >= slot.end) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Each availability slot must end after it starts' })
  for (let day = 0; day < 7; day++) {
    const slots = v.weekly.filter(s => s.day === day).sort((a, b) => a.start.localeCompare(b.start))
    for (let i = 1; i < slots.length; i++) if (slots[i].start < slots[i - 1].end) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Availability slots on the same day cannot overlap' })
  }
})

astrologersRouter.patch('/me/availability', requireAuth, (req, res) => {
  const a = own(currentUser(res).id)
  if (!a || a.status !== 'approved') throw new HttpError(403, 'FORBIDDEN', 'Only approved astrologers can update availability')
  const b = availabilityBody.parse(req.body)
  a.availability = { timezone: b.timezone, weekly: [...b.weekly].sort((x, y) => x.day - y.day || x.start.localeCompare(y.start)) }
  a.updatedAt = new Date().toISOString()
  save()
  ok(res, { application: ownView(a) })
})

astrologersRouter.patch('/me/pricing', requireAuth, (req, res) => {
  const a = own(currentUser(res).id)
  if (!a || a.status !== 'approved') throw new HttpError(403, 'FORBIDDEN', 'Only approved astrologers can update their prices')
  const b = z.object({
    chatPriceRupees: z.number().int().min(MIN_PRICE_RUPEES).max(MAX_PRICE_RUPEES),
    callPriceRupees: z.number().int().min(MIN_PRICE_RUPEES).max(MAX_PRICE_RUPEES),
  }).strict().parse(req.body)
  a.chatPricePaise = b.chatPriceRupees * 100
  a.callPricePaise = b.callPriceRupees * 100
  a.updatedAt = new Date().toISOString()
  save()
  ok(res, { application: ownView(a) })
})

astrologersRouter.get('/me/payouts', requireAuth, (_req, res) => {
  const a = approvedOwn(currentUser(res).id)
  const db = getDb()
  const earned = totalEarnings(a.id)
  const requests = db.astrologerPayouts.filter(p => p.astrologerId === a.id).sort((x, y) => y.requestedAt.localeCompare(x.requestedAt))
  const paid = requests.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amountPaise, 0)
  const reserved = requests.filter(p => p.status === 'requested' || p.status === 'approved').reduce((sum, p) => sum + p.amountPaise, 0)
  ok(res, { totalEarnedPaise: earned, reservedPaise: reserved, paidPaise: paid, availablePaise: Math.max(0, earned - reserved - paid), items: requests })
})

astrologersRouter.post('/me/payouts', requireAuth, (req, res) => {
  const a = approvedOwn(currentUser(res).id)
  const { amountPaise } = z.object({ amountPaise: z.number().int().positive().max(Number.MAX_SAFE_INTEGER) }).strict().parse(req.body)
  const db = getDb()
  const earned = totalEarnings(a.id)
  const reserved = db.astrologerPayouts.filter(p => p.astrologerId === a.id && (p.status === 'requested' || p.status === 'approved' || p.status === 'paid')).reduce((sum, p) => sum + p.amountPaise, 0)
  const availablePaise = Math.max(0, earned - reserved)
  if (amountPaise > availablePaise) throw new HttpError(409, 'INSUFFICIENT_EARNINGS', 'The requested amount exceeds your available earnings')
  const payout = { id: newId(), astrologerId: a.id, amountPaise, status: 'requested' as const, requestedAt: new Date().toISOString(), reviewedAt: null, paidAt: null, reference: null }
  db.astrologerPayouts.push(payout)
  save()
  ok(res, payout, 201)
})

astrologersRouter.post('/apply', requireAuth, applyLimiter, asyncHandler(async (req, res) => {
  const user = currentUser(res)
  const b = applyBody.parse(req.body)
  const existing = own(user.id)
  if (existing && existing.status !== 'rejected') throw new HttpError(409, 'EXISTS', existing.status === 'pending' ? 'Your application is already under review' : 'You already have an astrologer profile')
  const db = getDb(), now = new Date().toISOString()
  let slug = slugify(b.displayName), n = 2
  while (db.astrologers.some(a => a.slug === slug && a !== existing)) slug = `${slugify(b.displayName)}-${n++}`
  const rec: Astrologer = {
    id: existing?.id ?? newId(), userId: user.id, slug, displayName: b.displayName, bio: b.bio, experienceYears: b.experienceYears, gender: b.gender,
    languages: [...new Set(b.languages)], categories: [...new Set(b.categories)], skills: [...new Set(b.skills)],
    chatPricePaise: b.chatPriceRupees * 100, callPricePaise: b.callPriceRupees * 100, status: 'pending', isOnline: false, isBusy: false, badge: null, isDemo: false,
    createdAt: existing?.createdAt ?? now, updatedAt: now,
  }
  if (existing) Object.assign(existing, rec); else db.astrologers.push(rec)
  save()
  ok(res, { application: ownView(rec) }, 201)
}))

astrologersRouter.patch('/me/status', requireAuth, asyncHandler(async (req, res) => {
  const a = own(currentUser(res).id)
  if (!a || a.status !== 'approved') throw new HttpError(403, 'FORBIDDEN', 'Only approved astrologers can change their status')
  const b = z.object({ isOnline: z.boolean() }).strict().parse(req.body)
  if (!b.isOnline && hasOpenSession(a.userId!)) throw new HttpError(409, 'SESSION_OPEN', 'Finish or reject your current chat before going offline')
  a.isOnline = b.isOnline; if (!b.isOnline) a.isBusy = false
  a.updatedAt = new Date().toISOString()
  save()
  if (b.isOnline) notifyAvailability(a)
  ok(res, { application: ownView(a) })
}))

astrologersRouter.get('/:slug/availability-watch', requireAuth, (req, res) => {
  const a = approved().find(x => x.slug === req.params.slug)
  if (!a) throw new HttpError(404, 'NOT_FOUND', 'Astrologer not found')
  const userId = currentUser(res).id
  const watch = getAvailabilityWatch(userId, a.id)
  ok(res, { watch: watch ? { active: true, createdAt: watch.createdAt } : null, available: isAstrologerAvailable(a) })
})

astrologersRouter.post('/:slug/availability-watch', requireAuth, (req, res) => {
  const a = approved().find(x => x.slug === req.params.slug)
  if (!a) throw new HttpError(404, 'NOT_FOUND', 'Astrologer not found')
  if (isAstrologerAvailable(a)) throw new HttpError(409, 'ALREADY_AVAILABLE', 'This astrologer is available now. You can start a chat.')
  const watch = createAvailabilityWatch(currentUser(res).id, a.id)
  ok(res, { watch: { active: true, createdAt: watch.createdAt } }, 201)
})

astrologersRouter.delete('/:slug/availability-watch', requireAuth, (req, res) => {
  const a = approved().find(x => x.slug === req.params.slug)
  if (!a) throw new HttpError(404, 'NOT_FOUND', 'Astrologer not found')
  const removed = removeAvailabilityWatch(currentUser(res).id, a.id)
  ok(res, { removed })
})

astrologersRouter.get('/:slug', (req, res) => {
  const a = approved().find(x => x.slug === req.params.slug)
  if (!a) throw new HttpError(404, 'NOT_FOUND', 'Astrologer not found')
  const similar = approved().filter(x => x !== a && x.categories.some(c => a.categories.includes(c))).slice(0, 3).map(publicAstrologer)
  res.set('Cache-Control', 'no-store')
  ok(res, { astrologer: publicAstrologer(a), similar })
})

astrologersRouter.get('/:slug/reviews', (req, res) => {
  const a = approved().find(x => x.slug === req.params.slug)
  if (!a) throw new HttpError(404, 'NOT_FOUND', 'Astrologer not found')
  const page = z.coerce.number().int().min(1).max(1000).default(1).parse(req.query.page)
  const all = getDb().reviews.filter(r => r.astrologerId === a.id && r.isVisible).sort((x, y) => y.createdAt.localeCompare(x.createdAt))
  ok(res, { total: all.length, page, items: all.slice((page - 1) * 10, page * 10).map(r => ({ rating: r.rating, comment: r.comment, astrologerReply: r.astrologerReply, createdAt: r.createdAt })) })
})
