import { Router } from 'express'
import { z } from 'zod'
import { deleteAccount } from '../auth/service.js'
import { config } from '../config.js'
import { HttpError } from '../errors.js'
import { asyncHandler, ok } from '../http.js'
import { currentUser, requireAuth } from '../middleware/auth.js'
import { getDb, newId, save, type BirthProfile, type SavedKundli, type User } from '../store.js'
import { markNotificationRead, notificationsFor } from '../notifications/service.js'
import { isWebPushConfigured } from '../notifications/push.js'
import { birthDate, birthTime, createBirthProfileBody, patchBirthProfileBody, patchMeBody, timezone } from '../validators.js'

const publicUser = (u: User) => ({
  id: u.id, phone: u.phone, email: u.email, name: u.name, gender: u.gender, photoUrl: u.photoUrl,
  language: u.language, theme: u.theme, role: u.role, adminRole: u.role === 'admin' ? (u.adminRole ?? 'super_admin') : null, status: u.status ?? 'active', freeChatUsed: u.freeChatUsed, createdAt: u.createdAt,
})

const publicProfile = (b: BirthProfile) => {
  const { userId: _userId, ...rest } = b
  return rest
}
const publicKundli = (k: SavedKundli) => { const { userId: _userId, ...rest } = k; return rest }
const savedKundliBody = z.object({
  name: z.string().trim().min(1).max(80), birthDate, birthTime: birthTime.nullable(),
  latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), timezone,
}).strict()

const profilesOf = (userId: string) =>
  getDb().birthProfiles.filter(b => b.userId === userId).sort((a, b) => a.createdAt.localeCompare(b.createdAt))

function findOwned(userId: string, id: string): BirthProfile {
  const p = getDb().birthProfiles.find(b => b.id === id && b.userId === userId)
  if (!p) throw new HttpError(404, 'NOT_FOUND', 'Birth profile not found')
  return p
}

export const meRouter = Router()
meRouter.use(requireAuth)

meRouter.get('/', (_req, res) => ok(res, publicUser(currentUser(res))))

meRouter.patch('/', asyncHandler(async (req, res) => {
  const user = currentUser(res)
  const patch = patchMeBody.parse(req.body)
  Object.assign(user, patch, { updatedAt: new Date().toISOString() })
  save()
  ok(res, publicUser(user))
}))

meRouter.get('/export', (_req, res) => {
  const user = currentUser(res)
  ok(res, { exportedAt: new Date().toISOString(), user: publicUser(user), birthProfiles: profilesOf(user.id).map(publicProfile), savedKundlis: getDb().savedKundlis.filter(k => k.userId === user.id).map(publicKundli) })
})

meRouter.get('/notifications', (_req, res) => {
  const items = notificationsFor(currentUser(res).id)
  ok(res, { items, unread: items.filter(n => !n.readAt).length })
})

meRouter.get('/push/config', (_req, res) => {
  const userId = currentUser(res).id
  ok(res, {
    enabled: isWebPushConfigured(),
    publicKey: isWebPushConfigured() ? config.vapidPublicKey : null,
    subscribed: getDb().webPushSubscriptions.some(s => s.userId === userId),
  })
})

const pushSubscriptionBody = z.object({
  endpoint: z.string().url().max(2048).refine(value => {
    try {
      const host = new URL(value).hostname.toLowerCase()
      return value.startsWith('https://') && (
        host === 'fcm.googleapis.com' || host.endsWith('.push.services.mozilla.com') ||
        host === 'web.push.apple.com' || host.endsWith('.push.apple.com') || host.endsWith('.notify.windows.com')
      )
    } catch { return false }
  }, 'Push endpoint must be from a supported browser push service'),
  keys: z.object({ p256dh: z.string().min(20).max(256), auth: z.string().min(8).max(128) }).strict(),
}).strict()

meRouter.post('/push-subscriptions', asyncHandler(async (req, res) => {
  const user = currentUser(res)
  if (!isWebPushConfigured()) throw new HttpError(503, 'PUSH_DISABLED', 'Browser notifications are not configured on this server')
  const body = pushSubscriptionBody.parse(req.body)
  const db = getDb(), now = new Date().toISOString()
  const existing = db.webPushSubscriptions.find(s => s.endpoint === body.endpoint)
  if (existing && existing.userId !== user.id) throw new HttpError(409, 'PUSH_ENDPOINT_TAKEN', 'This browser subscription belongs to another account')
  if (!existing && db.webPushSubscriptions.filter(s => s.userId === user.id).length >= 10) throw new HttpError(409, 'LIMIT_REACHED', 'You can enable notifications on up to 10 devices')
  if (existing) Object.assign(existing, { keys: body.keys, updatedAt: now })
  else db.webPushSubscriptions.push({ id: newId(), userId: user.id, ...body, createdAt: now, updatedAt: now })
  save()
  ok(res, { saved: true }, existing ? 200 : 201)
}))

meRouter.delete('/push-subscriptions', asyncHandler(async (req, res) => {
  const userId = currentUser(res).id
  const { endpoint } = z.object({ endpoint: z.string().url().max(2048) }).strict().parse(req.body)
  const db = getDb(), before = db.webPushSubscriptions.length
  db.webPushSubscriptions = db.webPushSubscriptions.filter(s => s.userId !== userId || s.endpoint !== endpoint)
  if (db.webPushSubscriptions.length !== before) save()
  ok(res, { removed: db.webPushSubscriptions.length !== before })
}))

meRouter.patch('/notifications/:id/read', (req, res) => {
  const item = markNotificationRead(currentUser(res).id, String(req.params.id))
  if (!item) throw new HttpError(404, 'NOT_FOUND', 'Notification not found')
  ok(res, item)
})

meRouter.delete('/', asyncHandler(async (_req, res) => {
  deleteAccount(currentUser(res).id)
  ok(res, { deleted: true })
}))

meRouter.get('/kundlis', (_req, res) => ok(res, getDb().savedKundlis.filter(k => k.userId === currentUser(res).id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(publicKundli)))

meRouter.post('/kundlis', asyncHandler(async (req, res) => {
  const user = currentUser(res)
  const mine = getDb().savedKundlis.filter(k => k.userId === user.id)
  if (mine.length >= 30) throw new HttpError(409, 'LIMIT_REACHED', 'You can save up to 30 Kundlis')
  const body = savedKundliBody.parse(req.body)
  const kundli: SavedKundli = { id: newId(), userId: user.id, ...body, createdAt: new Date().toISOString() }
  getDb().savedKundlis.push(kundli); save()
  ok(res, publicKundli(kundli), 201)
}))

meRouter.get('/kundlis/:id', (req, res) => {
  const kundli = getDb().savedKundlis.find(k => k.id === req.params.id && k.userId === currentUser(res).id)
  if (!kundli) throw new HttpError(404, 'NOT_FOUND', 'Saved Kundli not found')
  ok(res, publicKundli(kundli))
})

meRouter.delete('/kundlis/:id', asyncHandler(async (req, res) => {
  const user = currentUser(res), db = getDb()
  const kundli = db.savedKundlis.find(k => k.id === req.params.id && k.userId === user.id)
  if (!kundli) throw new HttpError(404, 'NOT_FOUND', 'Saved Kundli not found')
  db.savedKundlis = db.savedKundlis.filter(k => k.id !== kundli.id); save()
  ok(res, { deleted: true })
}))

meRouter.get('/birth-profiles', (_req, res) => ok(res, profilesOf(currentUser(res).id).map(publicProfile)))

meRouter.post('/birth-profiles', asyncHandler(async (req, res) => {
  const user = currentUser(res)
  const body = createBirthProfileBody.parse(req.body)
  const mine = profilesOf(user.id)
  if (mine.length >= config.maxBirthProfiles) throw new HttpError(409, 'LIMIT_REACHED', `You can save up to ${config.maxBirthProfiles} birth profiles`)
  const makePrimary = body.isPrimary || mine.length === 0
  if (makePrimary) mine.forEach(p => { p.isPrimary = false })
  const profile: BirthProfile = { id: newId(), userId: user.id, ...body, isPrimary: makePrimary, createdAt: new Date().toISOString() }
  getDb().birthProfiles.push(profile)
  save()
  ok(res, publicProfile(profile), 201)
}))

meRouter.patch('/birth-profiles/:id', asyncHandler(async (req, res) => {
  const user = currentUser(res)
  const profile = findOwned(user.id, String(req.params.id))
  const patch = patchBirthProfileBody.parse(req.body)
  if (patch.isPrimary === false && profile.isPrimary) {
    throw new HttpError(409, 'PRIMARY_REQUIRED', 'Choose another profile as primary instead')
  }
  if (patch.isPrimary) profilesOf(user.id).forEach(p => { p.isPrimary = false })
  Object.assign(profile, patch)
  save()
  ok(res, publicProfile(profile))
}))

meRouter.delete('/birth-profiles/:id', asyncHandler(async (req, res) => {
  const user = currentUser(res)
  const profile = findOwned(user.id, String(req.params.id))
  const db = getDb()
  db.birthProfiles = db.birthProfiles.filter(b => b.id !== profile.id)
  if (profile.isPrimary) {
    const next = profilesOf(user.id)[0]
    if (next) next.isPrimary = true
  }
  save()
  ok(res, { deleted: true })
}))
