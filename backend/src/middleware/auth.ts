import type { RequestHandler } from 'express'
import { verifyAccess } from '../auth/tokens.js'
import { HttpError } from '../errors.js'
import { getDb, type User } from '../store.js'

export const requireAuth: RequestHandler = (req, res, next) => {
  const h = req.get('authorization') ?? ''
  const token = h.startsWith('Bearer ') ? h.slice(7) : ''
  const claims = token ? verifyAccess(token) : null
  const user = claims && getDb().users.find(u => u.id === claims.sub && !u.deletedAt)
  if (!user) return next(new HttpError(401, 'UNAUTHORIZED', 'Please sign in'))
  res.locals.user = user
  next()
}

export const currentUser = (res: { locals: Record<string, unknown> }): User => res.locals.user as User
