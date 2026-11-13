import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { config } from '../config.js'

export interface AccessClaims { sub: string; role: string }

export function signAccess(userId: string, role: string): string {
  return jwt.sign({ role }, config.jwtSecret, { subject: userId, expiresIn: config.accessTtlSec, algorithm: 'HS256' })
}

export function verifyAccess(token: string): AccessClaims | null {
  try {
    const p = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] })
    if (typeof p === 'string' || typeof p.sub !== 'string') return null
    return { sub: p.sub, role: String((p as Record<string, unknown>).role ?? 'user') }
  } catch {
    return null
  }
}

export const newRefreshToken = (): string => crypto.randomBytes(48).toString('base64url')
export const hashToken = (t: string): string => crypto.createHash('sha256').update(t).digest('hex')
export const hashOtp = (phone: string, code: string): string =>
  crypto.createHmac('sha256', config.otpSecret).update(`${phone}:${code}`).digest('hex')

export function safeEqualHex(a: string, b: string): boolean {
  const x = Buffer.from(a, 'hex'), y = Buffer.from(b, 'hex')
  return x.length === y.length && crypto.timingSafeEqual(x, y)
}
