import crypto from 'node:crypto'
import { config } from '../config.js'
import { HttpError } from '../errors.js'
import { sendSms } from '../sms.js'
import { getDb, newId, save, type Language, type ThemeMode, type User } from '../store.js'
import { hashOtp, hashToken, newRefreshToken, safeEqualHex, signAccess } from './tokens.js'

export interface ClientCtx { ip: string; device: string }

export interface Session {
  accessToken: string
  refreshToken: string
  expiresIn: number
  user: User
}

const HOUR = 60 * 60 * 1000

export async function sendOtp(phone: string): Promise<{ expiresInSec: number; resendAfterSec: number; devOtp?: string }> {
  const db = getDb()
  const now = Date.now()
  const mine = db.otps.filter(o => o.phone === phone)

  const last = mine.reduce((m, o) => Math.max(m, o.createdAt), 0)
  if (last && now - last < config.otpResendCooldownMs) {
    const wait = Math.ceil((config.otpResendCooldownMs - (now - last)) / 1000)
    throw new HttpError(429, 'OTP_COOLDOWN', `Please wait ${wait}s before requesting another code`, { retryAfterSec: wait })
  }
  if (mine.filter(o => now - o.createdAt < HOUR).length >= config.otpMaxPerHour) {
    throw new HttpError(429, 'OTP_LIMIT', 'Too many codes requested for this number. Try again in an hour.')
  }

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
  const rec = { id: newId(), phone, codeHash: hashOtp(phone, code), expiresAt: now + config.otpTtlMs, attempts: 0, createdAt: now, consumed: false }
  mine.forEach(o => { o.consumed = true }) // only the newest code is valid
  db.otps.push(rec)

  try {
    await sendSms(phone, `${code} is your Jyotiva login code. It expires in ${Math.round(config.otpTtlMs / 60000)} minutes. Do not share it.`)
  } catch (e) {
    db.otps = db.otps.filter(o => o.id !== rec.id) // a failed send must not burn the user's hourly quota
    throw e
  }
  save()
  return {
    expiresInSec: Math.round(config.otpTtlMs / 1000),
    resendAfterSec: Math.round(config.otpResendCooldownMs / 1000),
    ...(config.exposeDevOtp ? { devOtp: code } : {}),
  }
}

export async function verifyOtp(
  phone: string, code: string, ctx: ClientCtx, initial: { language?: Language; theme?: ThemeMode } = {},
): Promise<Session & { isNewUser: boolean }> {
  const db = getDb()
  const now = Date.now()
  const rec = db.otps
    .filter(o => o.phone === phone && !o.consumed && o.expiresAt > now)
    .sort((a, b) => b.createdAt - a.createdAt)[0]
  if (!rec) throw new HttpError(400, 'INVALID_OTP', 'That code is wrong or has expired. Request a new one.')
  if (rec.attempts >= config.otpMaxAttempts) {
    rec.consumed = true
    save()
    throw new HttpError(429, 'OTP_LOCKED', 'Too many wrong attempts. Request a new code.')
  }
  rec.attempts += 1
  if (!safeEqualHex(rec.codeHash, hashOtp(phone, code))) {
    save()
    const left = config.otpMaxAttempts - rec.attempts
    throw new HttpError(400, 'INVALID_OTP', left > 0 ? `Wrong code. ${left} attempt${left === 1 ? '' : 's'} left.` : 'Too many wrong attempts. Request a new code.', { attemptsLeft: left })
  }
  rec.consumed = true

  let user = db.users.find(u => u.phone === phone && !u.deletedAt)
  const isNewUser = !user
  if (!user) {
    const iso = new Date(now).toISOString()
    user = { id: newId(), phone, email: null, name: '', gender: null, photoUrl: null, language: initial.language ?? 'en', theme: initial.theme ?? 'auto', role: 'user', freeChatUsed: false, createdAt: iso, updatedAt: iso, deletedAt: null }
    db.users.push(user)
  }
  const session = issueSession(user, ctx, newId())
  return { ...session, isNewUser }
}

function issueSession(user: User, ctx: ClientCtx, familyId: string): Session {
  const db = getDb()
  const now = Date.now()
  const refreshToken = newRefreshToken()
  db.refreshTokens.push({
    id: newId(), userId: user.id, familyId, tokenHash: hashToken(refreshToken),
    device: ctx.device, ip: ctx.ip, createdAt: now, expiresAt: now + config.refreshTtlMs, revokedAt: null,
  })
  save()
  return { accessToken: signAccess(user.id, user.role), refreshToken, expiresIn: config.accessTtlSec, user }
}

function revokeFamily(familyId: string, now: number): void {
  for (const t of getDb().refreshTokens) if (t.familyId === familyId && !t.revokedAt) t.revokedAt = now
}

/** Rotating refresh. Presenting an already-used token means it leaked: kill the whole family. */
export function refresh(token: string, ctx: ClientCtx): Session {
  const db = getDb()
  const now = Date.now()
  const rec = db.refreshTokens.find(t => t.tokenHash === hashToken(token))
  if (!rec) throw new HttpError(401, 'INVALID_REFRESH', 'Session expired. Please sign in again.')
  if (rec.revokedAt) {
    revokeFamily(rec.familyId, now)
    save()
    throw new HttpError(401, 'REFRESH_REUSED', 'Session expired. Please sign in again.')
  }
  if (rec.expiresAt <= now) throw new HttpError(401, 'INVALID_REFRESH', 'Session expired. Please sign in again.')
  const user = db.users.find(u => u.id === rec.userId && !u.deletedAt)
  if (!user) throw new HttpError(401, 'INVALID_REFRESH', 'Session expired. Please sign in again.')
  rec.revokedAt = now
  return issueSession(user, ctx, rec.familyId)
}

export function logout(token: string): void {
  const rec = getDb().refreshTokens.find(t => t.tokenHash === hashToken(token))
  if (rec) { revokeFamily(rec.familyId, Date.now()); save() }
}

/**
 * DPDP-style erasure: remove birth data and sessions, scrub the user row, free the phone number.
 * TODO (Phase 7, free chat): keep a one-way phone-hash tombstone, otherwise delete + re-signup
 * hands out a second free chat.
 */
export function deleteAccount(userId: string): void {
  const db = getDb()
  const user = db.users.find(u => u.id === userId)
  if (!user) return
  db.birthProfiles = db.birthProfiles.filter(b => b.userId !== userId)
  db.refreshTokens = db.refreshTokens.filter(t => t.userId !== userId)
  db.otps = db.otps.filter(o => o.phone !== user.phone)
  Object.assign(user, { phone: `deleted:${user.id}`, email: null, name: '', gender: null, photoUrl: null, deletedAt: new Date().toISOString() })
  save()
}
