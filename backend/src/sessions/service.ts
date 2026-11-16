import crypto from 'node:crypto'
import { EventEmitter } from 'node:events'
import { config } from '../config.js'
import { HttpError } from '../errors.js'
import { getDb, newId, save, type Astrologer, type ChatMessage, type ChatReportReason, type Session, type User } from '../store.js'
import { creditWallet, debitWallet, getWallet } from '../wallet/service.js'
import { notifyAvailability } from '../notifications/service.js'
import { isAstrologerLive } from '../astrologers/presence.js'

/** Tunable at runtime so tests can shorten them. */
export const rules = {
  requestTimeoutMs: 90_000,
  minBalanceMinutes: 5,
  disconnectGraceMs: 60_000,
  freeChatSeconds: config.freeChatSeconds,
  demoBot: config.demoBot,
}

/** The socket layer listens here, so this file never imports socket.io. */
export const bus = new EventEmitter()

const OPEN: Session['status'][] = ['requested', 'active']
const find = (id: string): Session => {
  const s = getDb().sessions.find(x => x.id === id)
  if (!s) throw new HttpError(404, 'NOT_FOUND', 'Chat not found')
  return s
}
export const astrologerOf = (s: Session): Astrologer => getDb().astrologers.find(a => a.id === s.astrologerId)!
const err = (status: number, code: string, msg: string, extra?: Record<string, unknown>) => new HttpError(status, code, msg, extra)

export const phoneKey = (phone: string): string => crypto.createHmac('sha256', config.otpSecret).update('free:' + phone).digest('hex')
export const freeChatAvailable = (u: User): boolean => !u.freeChatUsed && !getDb().freeChatPhones.includes(phoneKey(u.phone))
export const openSessionOf = (userId: string): Session | undefined => getDb().sessions.find(s => s.userId === userId && OPEN.includes(s.status))
export const hasOpenSession = (userId: string): boolean => {
  const db = getDb(), a = db.astrologers.find(x => x.userId === userId)
  return !!openSessionOf(userId) || (!!a && db.sessions.some(s => s.astrologerId === a.id && OPEN.includes(s.status)))
}

// ---- presence (who is connected right now) ----
const present = new Map<string, Set<string>>()
const lastPresent = new Map<string, number>()
const lowSent = new Set<string>()
export function markPresent(sessionId: string, socketId: string, now = Date.now()): void {
  if (!present.has(sessionId)) present.set(sessionId, new Set())
  present.get(sessionId)!.add(socketId); lastPresent.set(sessionId, now)
}
export function markAbsent(sessionId: string, socketId: string, now = Date.now()): void {
  const set = present.get(sessionId); if (!set) return
  set.delete(socketId); if (set.size === 0) lastPresent.set(sessionId, now)
}

// ---- messages ----
function pushMessage(s: Session, role: ChatMessage['senderRole'], body: string, now: number): ChatMessage {
  const m: ChatMessage = { id: newId(), sessionId: s.id, senderRole: role, body, createdAt: now, readAt: null }
  getDb().messages.push(m); save(); bus.emit('message', m)
  return m
}
const system = (s: Session, text: string, now = Date.now()) => pushMessage(s, 'system', text, now)

export const roleOf = (s: Session, userId: string): 'user' | 'astrologer' | null =>
  s.userId === userId ? 'user' : astrologerOf(s)?.userId === userId ? 'astrologer' : null

export function sendMessage(userId: string, sessionId: string, bodyRaw: string, now = Date.now()): ChatMessage {
  const s = find(sessionId), role = roleOf(s, userId)
  if (!role) throw err(403, 'FORBIDDEN', 'This is not your chat')
  const body = bodyRaw.trim()
  if (!body) throw err(400, 'VALIDATION', 'Message is empty')
  if (body.length > 2000) throw err(400, 'VALIDATION', 'Message is too long (2000 characters max)')
  if (s.status !== 'active') throw err(409, 'NOT_ACTIVE', 'This chat is not active')
  const m = pushMessage(s, role, body, now)
  if (role === 'user' && astrologerOf(s).isDemo && rules.demoBot) {
    setTimeout(() => { const x = getDb().sessions.find(y => y.id === s.id); if (x?.status === 'active') system(x, '[Demo] This is an automated reply from a demo profile. A real astrologer would answer here.') }, 1200).unref()
  }
  return m
}
export function markRead(userId: string, sessionId: string, now = Date.now()): void {
  const s = find(sessionId), role = roleOf(s, userId); if (!role) return
  let changed = false
  for (const m of getDb().messages) if (m.sessionId === s.id && m.senderRole !== role && m.senderRole !== 'system' && !m.readAt) { m.readAt = now; changed = true }
  if (changed) { save(); bus.emit('read', { sessionId: s.id, by: role, at: now }) }
}
export const messagesOf = (s: Session): ChatMessage[] => getDb().messages.filter(m => m.sessionId === s.id).sort((a, b) => a.createdAt - b.createdAt)

// ---- lifecycle ----
export function createSession(user: User, input: { astrologerSlug: string; birthProfileId: string; free?: boolean }, now = Date.now()): Session {
  const db = getDb()
  const a = db.astrologers.find(x => x.slug === input.astrologerSlug && x.status === 'approved')
  if (!a) throw err(404, 'NOT_FOUND', 'Astrologer not found')
  if (a.userId === user.id) throw err(400, 'SELF_CHAT', 'You cannot chat with yourself')
  if (a.isDemo && !rules.demoBot) throw err(409, 'DEMO_PROFILE', 'This is a demo profile and cannot take chats')
  const mine = openSessionOf(user.id)
  if (mine) throw err(409, 'SESSION_OPEN', 'You already have a chat in progress', { sessionId: mine.id })
  if (!isAstrologerLive(a)) throw err(409, 'ASTROLOGER_OFFLINE', 'This astrologer is offline right now')
  if (a.isBusy || db.sessions.some(s => s.astrologerId === a.id && OPEN.includes(s.status))) throw err(409, 'ASTROLOGER_BUSY', 'This astrologer is busy with another chat. Try again in a few minutes.')
  const bp = db.birthProfiles.find(b => b.id === input.birthProfileId && b.userId === user.id)
  if (!bp) throw err(400, 'BIRTH_PROFILE', 'Choose one of your saved birth profiles')
  const isFree = (input.free ?? true) && freeChatAvailable(user)
  if (!isFree) {
    const need = a.chatPricePaise * rules.minBalanceMinutes, bal = getWallet(user.id).balancePaise
    if (bal < need) throw err(402, 'INSUFFICIENT_BALANCE', `Keep at least ₹${need / 100} in your wallet (${rules.minBalanceMinutes} minutes) to start this chat`, { requiredPaise: need, balancePaise: bal })
  }
  const s: Session = {
    id: newId(), userId: user.id, astrologerId: a.id, type: 'chat', status: 'requested', isFree, pricePerMinPaise: a.chatPricePaise,
    birth: { name: bp.name, gender: bp.gender, birthDate: bp.birthDate, birthTime: bp.birthTime, birthPlace: bp.birthPlace, latitude: bp.latitude, longitude: bp.longitude, timezone: bp.timezone },
    requestedAt: now, startedAt: null, endedAt: null, durationSeconds: 0, billedMinutes: 0, amountChargedPaise: 0, platformFeePaise: 0, astrologerEarningPaise: 0,
    endReason: null, reviewId: null, refundStatus: 'none', refundedPaise: 0,
  }
  db.sessions.push(s); save(); bus.emit('session', s)
  if (a.isDemo && rules.demoBot) setTimeout(() => { const x = getDb().sessions.find(y => y.id === s.id); if (x?.status === 'requested') { try { activate(x, a, Date.now()) } catch { /* user balance changed */ } } }, 2000).unref()
  return s
}

const chargeMinute = (s: Session, n: number): void => {
  debitWallet(s.userId, s.pricePerMinPaise, 'session', `${s.id}:m${n}`, `Chat with ${astrologerOf(s).displayName}, minute ${n}`)
  s.billedMinutes = n; s.amountChargedPaise += s.pricePerMinPaise
}

function activate(s: Session, a: Astrologer, now: number): void {
  if (a.isBusy) throw err(409, 'ASTROLOGER_BUSY', 'You are already in another chat')
  if (!s.isFree) {
    try { chargeMinute(s, 1) } catch (e) {
      if (e instanceof HttpError && e.code === 'INSUFFICIENT_BALANCE') { s.status = 'cancelled'; s.endedAt = now; s.endReason = 'user_balance'; save(); bus.emit('session', s); throw err(409, 'USER_BALANCE', 'The user no longer has enough balance') }
      throw e
    }
  } else {
    const u = getDb().users.find(x => x.id === s.userId); if (u) u.freeChatUsed = true
  }
  s.status = 'active'; s.startedAt = now; a.isBusy = true; lastPresent.set(s.id, now)
  save()
  system(s, s.isFree ? `Chat started. This free chat lasts ${Math.round(rules.freeChatSeconds / 60)} minutes.` : `Chat started at ₹${s.pricePerMinPaise / 100} per minute. Billing is per minute, charged at the start of each minute.`, now)
  bus.emit('session', s); emitBalance(s)
}

const ownAstrologer = (userId: string): Astrologer => {
  const a = getDb().astrologers.find(x => x.userId === userId && x.status === 'approved')
  if (!a) throw err(403, 'FORBIDDEN', 'Only approved astrologers can do this')
  return a
}
function pendingFor(userId: string, id: string, now: number): { s: Session; a: Astrologer } {
  const a = ownAstrologer(userId), s = find(id)
  if (s.astrologerId !== a.id) throw err(403, 'FORBIDDEN', 'This request is not for you')
  if (s.status !== 'requested') throw err(409, 'NOT_PENDING', 'This request is no longer open')
  if (now - s.requestedAt >= rules.requestTimeoutMs) { s.status = 'missed'; s.endedAt = now; s.endReason = 'timeout'; save(); bus.emit('session', s); notifyAvailability(a); throw err(409, 'EXPIRED', 'This request has expired') }
  return { s, a }
}
export function acceptSession(userId: string, id: string, now = Date.now()): Session { const { s, a } = pendingFor(userId, id, now); activate(s, a, now); return s }
export function rejectSession(userId: string, id: string, now = Date.now()): Session {
  const { s } = pendingFor(userId, id, now)
  s.status = 'rejected'; s.endedAt = now; s.endReason = 'astrologer_rejected'; save(); bus.emit('session', s); notifyAvailability(astrologerOf(s)); return s
}
export function cancelSession(userId: string, id: string, now = Date.now()): Session {
  const s = find(id)
  if (s.userId !== userId) throw err(403, 'FORBIDDEN', 'This is not your chat')
  if (s.status !== 'requested') throw err(409, 'NOT_PENDING', 'This request is no longer open')
  s.status = 'cancelled'; s.endedAt = now; s.endReason = 'user_cancelled'; save(); bus.emit('session', s); notifyAvailability(astrologerOf(s)); return s
}

const paidUntil = (s: Session): number | null =>
  s.startedAt === null ? null : s.isFree ? s.startedAt + rules.freeChatSeconds * 1000 : s.startedAt + s.billedMinutes * 60_000

/** Closes an active chat. `endedAt` can be earlier than `now` (e.g. when the paid minute ran out). */
export function finish(s: Session, reason: string, now: number, endedAt = now): void {
  if (s.status !== 'active' || s.startedAt === null) return
  s.status = 'ended'; s.endedAt = Math.max(s.startedAt, endedAt); s.endReason = reason
  s.durationSeconds = Math.round((s.endedAt - s.startedAt) / 1000)
  if (s.isFree) { s.astrologerEarningPaise = config.freeChatPayoutPaise }
  else { s.platformFeePaise = Math.floor((s.amountChargedPaise * config.platformCommissionPercent) / 100); s.astrologerEarningPaise = s.amountChargedPaise - s.platformFeePaise }
  const a = astrologerOf(s); a.isBusy = false
  present.delete(s.id); lastPresent.delete(s.id); lowSent.delete(s.id)
  const why: Record<string, string> = { balance: 'Chat ended because the wallet balance ran out.', free_limit: 'The free chat time is over.', disconnected: 'Chat ended because both sides were offline.', server_restart: 'Chat ended because of a server restart.', user: 'The user ended the chat.', astrologer: 'The astrologer ended the chat.' }
  system(s, why[reason] ?? 'Chat ended.', s.endedAt)
  save(); bus.emit('session', s)
  if (reason !== 'server_restart') notifyAvailability(a)
}

export function endByParticipant(userId: string, id: string, now = Date.now()): Session {
  const s = find(id), role = roleOf(s, userId)
  if (!role) throw err(403, 'FORBIDDEN', 'This is not your chat')
  if (s.status === 'requested' && role === 'user') return cancelSession(userId, id, now)
  if (s.status !== 'active') throw err(409, 'NOT_ACTIVE', 'This chat is not active')
  finish(s, role, now)
  return s
}

function emitBalance(s: Session): void {
  bus.emit('balance', { userId: s.userId, sessionId: s.id, balancePaise: getWallet(s.userId).balancePaise, paidUntil: paidUntil(s), billedMinutes: s.billedMinutes })
}

/** Runs every second: request timeouts, per-minute billing, free-chat cap, disconnect cleanup. Pass `now` in tests. */
export function tick(now = Date.now()): void {
  for (const s of getDb().sessions) {
    if (s.status === 'requested') {
      if (now - s.requestedAt >= rules.requestTimeoutMs) { s.status = 'missed'; s.endedAt = now; s.endReason = 'timeout'; save(); bus.emit('session', s); notifyAvailability(astrologerOf(s)) }
      continue
    }
    if (s.status !== 'active' || s.startedAt === null) continue
    if ((present.get(s.id)?.size ?? 0) > 0) lastPresent.set(s.id, now)
    if (now - (lastPresent.get(s.id) ?? s.startedAt) > rules.disconnectGraceMs) { finish(s, 'disconnected', now); continue }
    const elapsed = now - s.startedAt
    if (s.isFree) { if (elapsed >= rules.freeChatSeconds * 1000) finish(s, 'free_limit', now, s.startedAt + rules.freeChatSeconds * 1000); continue }
    const minute = Math.floor(elapsed / 60_000) + 1
    let charged = false
    while (s.billedMinutes < minute) {
      try { chargeMinute(s, s.billedMinutes + 1); charged = true } catch (e) {
        if (e instanceof HttpError && e.code === 'INSUFFICIENT_BALANCE') { finish(s, 'balance', now, s.startedAt + s.billedMinutes * 60_000); break }
        throw e
      }
    }
    if (s.status !== 'active') continue
    if (charged) { save(); emitBalance(s) }
    const bal = getWallet(s.userId).balancePaise
    if (bal < s.pricePerMinPaise && !lowSent.has(s.id)) { lowSent.add(s.id); bus.emit('low', { userId: s.userId, sessionId: s.id, balancePaise: bal }) }
    if (bal >= s.pricePerMinPaise) lowSent.delete(s.id)
  }
}

/** After a restart no socket is connected, so close what was open. Minutes already billed stay billed. */
export function recoverSessions(now = Date.now()): number {
  let n = 0
  for (const s of getDb().sessions) {
    if (s.status === 'requested') { s.status = 'missed'; s.endedAt = now; s.endReason = 'server_restart'; n++ }
    else if (s.status === 'active') { finish(s, 'server_restart', now, Math.min(now, paidUntil(s) ?? now)); n++ }
  }
  for (const a of getDb().astrologers) a.isBusy = false
  if (n) save()
  return n
}

// ---- reviews and refunds ----
export function reportSession(reporterId: string, id: string, reason: ChatReportReason, details: string) {
  const s = find(id), reporterRole = roleOf(s, reporterId)
  if (!reporterRole) throw err(403, 'FORBIDDEN', 'This is not your chat')
  if (s.status !== 'active' && s.status !== 'ended') throw err(409, 'NOT_REPORTABLE', 'A chat can be reported after it starts')
  if (getDb().chatReports.some(r => r.sessionId === s.id && r.reporterId === reporterId)) throw err(409, 'ALREADY_REPORTED', 'You have already reported this chat')
  const astrologer = astrologerOf(s)
  if (astrologer.isDemo || !astrologer.userId) throw err(409, 'DEMO_REPORT', 'Demo chats cannot be reported')
  const reportedUserId = reporterRole === 'user' ? astrologer.userId : s.userId
  const report = {
    id: newId(), sessionId: s.id, reporterId, reporterRole,
    reportedUserId, reportedRole: reporterRole === 'user' ? 'astrologer' as const : 'user' as const,
    reason, details: details.trim(), status: 'open' as const,
    createdAt: new Date().toISOString(), reviewedAt: null, reviewerId: null, resolutionNote: null,
  }
  getDb().chatReports.push(report); save()
  return report
}

export function hasReportedChat(userId: string, sessionId: string): boolean {
  return getDb().chatReports.some(r => r.sessionId === sessionId && r.reporterId === userId)
}

export function reviewSession(userId: string, id: string, rating: number, comment: string, now = Date.now()) {
  const s = find(id)
  if (s.userId !== userId) throw err(403, 'FORBIDDEN', 'This is not your chat')
  if (s.status !== 'ended') throw err(409, 'NOT_ENDED', 'You can review a chat after it has ended')
  if (s.reviewId) throw err(409, 'ALREADY_REVIEWED', 'You already reviewed this chat')
  if (astrologerOf(s).isDemo) throw err(409, 'DEMO_PROFILE', 'Demo profiles cannot be reviewed')
  const r = { id: newId(), astrologerId: s.astrologerId, userId, rating, comment: comment.trim(), astrologerReply: null, isVisible: true, createdAt: new Date(now).toISOString(), sessionId: s.id }
  getDb().reviews.push(r); s.reviewId = r.id
  if (rating <= 2 && s.amountChargedPaise > 0) s.refundStatus = 'flagged' // an admin reviews it (plan 9.3)
  save()
  return r
}

export function refundSession(adminId: string, id: string, amountPaise: number, reason: string): Session {
  const s = find(id)
  if (s.status !== 'ended') throw err(409, 'NOT_ENDED', 'Only ended chats can be refunded')
  if (s.refundStatus === 'refunded') throw err(409, 'ALREADY_REFUNDED', 'This chat was already refunded')
  if (amountPaise <= 0 || amountPaise > s.amountChargedPaise) throw err(400, 'VALIDATION', `Refund must be between ₹0.01 and ₹${s.amountChargedPaise / 100}`)
  creditWallet(s.userId, 'refund', amountPaise, 'session', `${s.id}:refund`, reason)
  s.refundStatus = 'refunded'; s.refundedPaise = amountPaise; save()
  return s
}

// ---- views ----
export function sessionView(s: Session, viewer: 'user' | 'astrologer') {
  const a = astrologerOf(s)
  return {
    id: s.id, type: s.type, status: s.status, isFree: s.isFree, viewerRole: viewer, pricePerMinPaise: s.pricePerMinPaise,
    requestedAt: new Date(s.requestedAt).toISOString(), requestExpiresAt: new Date(s.requestedAt + rules.requestTimeoutMs).toISOString(),
    startedAt: s.startedAt ? new Date(s.startedAt).toISOString() : null, endedAt: s.endedAt ? new Date(s.endedAt).toISOString() : null,
    paidUntil: paidUntil(s) ? new Date(paidUntil(s)!).toISOString() : null,
    durationSeconds: s.durationSeconds, billedMinutes: s.billedMinutes, endReason: s.endReason, freeChatSeconds: rules.freeChatSeconds,
    ...(viewer === 'user' ? { amountChargedPaise: s.amountChargedPaise, refundStatus: s.refundStatus, refundedPaise: s.refundedPaise } : { astrologerEarningPaise: s.astrologerEarningPaise }),
    reviewed: !!s.reviewId,
    reported: hasReportedChat(viewer === 'user' ? s.userId : a.userId ?? '', s.id),
    astrologer: { slug: a.slug, displayName: a.displayName, isDemo: a.isDemo },
    birth: s.birth, // name and birth details only: the astrologer never sees the phone number
  }
}
export function viewFor(s: Session, userId: string) { const r = roleOf(s, userId); if (!r) throw err(403, 'FORBIDDEN', 'This is not your chat'); return sessionView(s, r) }
export const getSession = find
export const mySessions = (userId: string): Session[] => getDb().sessions.filter(s => s.userId === userId).sort((a, b) => b.requestedAt - a.requestedAt)
export function incomingFor(userId: string): Session[] {
  const a = ownAstrologer(userId)
  return getDb().sessions.filter(s => s.astrologerId === a.id).sort((x, y) => y.requestedAt - x.requestedAt).slice(0, 30)
}
