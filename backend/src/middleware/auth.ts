import type { RequestHandler } from 'express'
import { verifyAccess } from '../auth/tokens.js'
import { HttpError } from '../errors.js'
import { getDb, type AdminRole, type User } from '../store.js'

export const requireAuth: RequestHandler = (req, res, next) => {
  const h = req.get('authorization') ?? ''
  const token = h.startsWith('Bearer ') ? h.slice(7) : ''
  const claims = token ? verifyAccess(token) : null
  const user = claims && getDb().users.find(u => u.id === claims.sub && !u.deletedAt)
  if (!user) return next(new HttpError(401, 'UNAUTHORIZED', 'Please sign in'))
  if (user.status === 'suspended') return next(new HttpError(403, 'ACCOUNT_SUSPENDED', 'This account is suspended. Contact support for assistance.'))
  res.locals.user = user
  next()
}

export const currentUser = (res: { locals: Record<string, unknown> }): User => res.locals.user as User

export const requireAdmin: RequestHandler = (_req, res, next) => {
  if (currentUser(res).role !== 'admin') return next(new HttpError(403, 'FORBIDDEN', 'Admin access only'))
  next()
}

export const requireAdminRole = (...allowed: AdminRole[]): RequestHandler => (_req, res, next) => {
  const user = currentUser(res)
  const role = user.adminRole ?? 'super_admin'
  if (user.role !== 'admin' || (role !== 'super_admin' && !allowed.includes(role))) {
    return next(new HttpError(403, 'FORBIDDEN', 'Your admin role does not have permission for this action'))
  }
  next()
}
