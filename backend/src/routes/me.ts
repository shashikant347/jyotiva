import { Router } from 'express'
import { deleteAccount } from '../auth/service.js'
import { config } from '../config.js'
import { HttpError } from '../errors.js'
import { asyncHandler, ok } from '../http.js'
import { currentUser, requireAuth } from '../middleware/auth.js'
import { getDb, newId, save, type BirthProfile, type User } from '../store.js'
import { createBirthProfileBody, patchBirthProfileBody, patchMeBody } from '../validators.js'

const publicUser = (u: User) => ({
  id: u.id, phone: u.phone, email: u.email, name: u.name, gender: u.gender, photoUrl: u.photoUrl,
  language: u.language, theme: u.theme, role: u.role, freeChatUsed: u.freeChatUsed, createdAt: u.createdAt,
})

const publicProfile = (b: BirthProfile) => {
  const { userId: _userId, ...rest } = b
  return rest
}

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
  ok(res, { exportedAt: new Date().toISOString(), user: publicUser(user), birthProfiles: profilesOf(user.id).map(publicProfile) })
})

meRouter.delete('/', asyncHandler(async (_req, res) => {
  deleteAccount(currentUser(res).id)
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
