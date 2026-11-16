import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, before, test } from 'node:test'
import type { Server } from 'node:http'
import { io as connect, type Socket } from 'socket.io-client'

process.env.DATA_FILE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'jv-s-')), 'db.json')
process.env.DEMO_BOT = 'false'
const { createApp } = await import('../app.js')
const { config } = await import('../config.js')
const { getDb, newId } = await import('../store.js')
const { signAccess } = await import('../auth/tokens.js')
const { creditWallet, getWallet } = await import('../wallet/service.js')
const S = await import('./service.js')
const { attachSockets } = await import('./socket.js')
const { deleteAccount } = await import('../auth/service.js')

const T0 = 1_800_000_000_000
const PRICE = 3000 // Rs 30 per minute
let srv: Server, base = '', astrologerSocket: Socket
const tok: Record<string, string> = {}, ids: Record<string, string> = {}, bp: Record<string, string> = {}
let astroId = '', slug = ''

const mkUser = (name: string, phone: string, role: 'user' | 'astrologer' = 'user') => {
  const id = newId(), iso = new Date().toISOString()
  getDb().users.push({ id, phone, email: null, name, gender: null, photoUrl: null, language: 'en', theme: 'auto', role, freeChatUsed: false, createdAt: iso, updatedAt: iso, deletedAt: null })
  ids[name] = id; tok[name] = signAccess(id, role)
  getDb().birthProfiles.push({ id: 'bp-' + name, userId: id, name, gender: 'female', birthDate: '1995-04-12', birthTime: '08:30', birthPlace: 'Delhi', latitude: 28.6, longitude: 77.2, timezone: 'Asia/Kolkata', isPrimary: true, createdAt: iso })
  bp[name] = 'bp-' + name
  return id
}
const call = async (who: string, method: string, url: string, body?: unknown) => {
  const r = await fetch(base + '/api/v1' + url, { method, headers: { Authorization: `Bearer ${tok[who]}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined })
  return { status: r.status, json: (await r.json()) as { success: boolean; data?: any; error?: { code: string; message: string } } }
}
const freshAstro = () => { const a = getDb().astrologers.find(x => x.id === astroId)!; a.isBusy = false; a.isOnline = true; return a }
const reset = () => { getDb().sessions.length = 0; getDb().messages.length = 0; freshAstro() }
const fund = (who: string, paise: number) => { const bal = getWallet(ids[who]).balancePaise; if (bal < paise) creditWallet(ids[who], 'adjustment', paise - bal, 'admin', 'f' + newId(), 'test') }
const usedFree = (who: string) => { getDb().users.find(u => u.id === ids[who])!.freeChatUsed = true }

before(async () => {
  mkUser('u1', '+919100000001'); mkUser('u2', '+919100000002'); mkUser('ast', '+919100000003', 'astrologer'); mkUser('other', '+919100000004')
  const iso = new Date().toISOString()
  astroId = newId(); slug = 'test-astro'
  getDb().astrologers.push({ id: astroId, userId: ids.ast, slug, displayName: 'Test Astro', bio: 'x'.repeat(30), experienceYears: 5, gender: 'male', languages: ['hi'], categories: ['love'], skills: ['vedic'], chatPricePaise: PRICE, callPricePaise: PRICE, status: 'approved', isOnline: true, isBusy: false, badge: null, isDemo: false, createdAt: iso, updatedAt: iso })
  const app = createApp(); srv = app.listen(0); attachSockets(srv)
  base = `http://localhost:${(srv.address() as { port: number }).port}`
  astrologerSocket = connect(base, { auth: { token: tok.ast }, reconnection: false })
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Test astrologer socket did not connect')), 3000)
    astrologerSocket.once('connect', () => { clearTimeout(timeout); resolve() })
    astrologerSocket.once('connect_error', error => { clearTimeout(timeout); reject(error) })
  })
})
after(() => { astrologerSocket?.disconnect(); srv.closeAllConnections?.(); srv.close() })

test('request rules: wallet minimum, offline, busy, own profile', () => {
  reset(); usedFree('u1')
  const u1 = getDb().users.find(u => u.id === ids.u1)!
  assert.throws(() => S.createSession(u1, { astrologerSlug: slug, birthProfileId: bp.u1 }, T0), (e: any) => e.code === 'INSUFFICIENT_BALANCE' && e.extra.requiredPaise === PRICE * 5)
  fund('u1', PRICE * 5)
  freshAstro().isOnline = false
  assert.throws(() => S.createSession(u1, { astrologerSlug: slug, birthProfileId: bp.u1 }, T0), (e: any) => e.code === 'ASTROLOGER_OFFLINE')
  freshAstro()
  assert.throws(() => S.createSession(u1, { astrologerSlug: slug, birthProfileId: 'bp-u2' }, T0), (e: any) => e.code === 'BIRTH_PROFILE')
  const astroUser = getDb().users.find(u => u.id === ids.ast)!
  assert.throws(() => S.createSession(astroUser, { astrologerSlug: slug, birthProfileId: bp.ast }, T0), (e: any) => e.code === 'SELF_CHAT')
  const s = S.createSession(u1, { astrologerSlug: slug, birthProfileId: bp.u1 }, T0)
  assert.equal(s.status, 'requested')
  assert.throws(() => S.createSession(u1, { astrologerSlug: slug, birthProfileId: bp.u1 }, T0), (e: any) => e.code === 'SESSION_OPEN')
  fund('u2', PRICE * 5); usedFree('u2')
  const u2 = getDb().users.find(u => u.id === ids.u2)!
  assert.throws(() => S.createSession(u2, { astrologerSlug: slug, birthProfileId: bp.u2 }, T0), (e: any) => e.code === 'ASTROLOGER_BUSY')
})

test('request times out after 90 seconds; late accept is refused', () => {
  reset(); fund('u1', PRICE * 5); usedFree('u1')
  const u1 = getDb().users.find(u => u.id === ids.u1)!
  const s = S.createSession(u1, { astrologerSlug: slug, birthProfileId: bp.u1 }, T0)
  S.tick(T0 + 89_000); assert.equal(s.status, 'requested')
  assert.throws(() => S.acceptSession(ids.ast, s.id, T0 + 91_000), (e: any) => e.code === 'EXPIRED')
  assert.equal(s.status, 'missed')
  const s2 = S.createSession(u1, { astrologerSlug: slug, birthProfileId: bp.u1 }, T0 + 100_000)
  S.tick(T0 + 100_000 + 90_000); assert.equal(s2.status, 'missed')
})

test('billing: charged per started minute, exact amounts, commission split', () => {
  reset(); getDb().walletTxs.length = 0; getWallet(ids.u1).balancePaise = 0; fund('u1', PRICE * 10); usedFree('u1')
  const u1 = getDb().users.find(u => u.id === ids.u1)!
  const s = S.createSession(u1, { astrologerSlug: slug, birthProfileId: bp.u1 }, T0)
  S.acceptSession(ids.ast, s.id, T0); S.markPresent(s.id, 'sock', T0)
  assert.equal(s.status, 'active'); assert.equal(s.amountChargedPaise, PRICE) // minute 1 prepaid
  assert.equal(freshBusy(), true)
  S.tick(T0 + 59_000); assert.equal(s.billedMinutes, 1)
  S.tick(T0 + 60_000); assert.equal(s.billedMinutes, 2)
  S.tick(T0 + 60_000); assert.equal(s.billedMinutes, 2, 'ticking twice in one minute never double-charges')
  S.tick(T0 + 125_000); assert.equal(s.billedMinutes, 3)
  S.endByParticipant(ids.u1, s.id, T0 + 130_000)
  assert.equal(s.status, 'ended'); assert.equal(s.durationSeconds, 130)
  assert.equal(s.amountChargedPaise, PRICE * 3)
  assert.equal(s.platformFeePaise, Math.floor(PRICE * 3 * config.platformCommissionPercent / 100))
  assert.equal(s.platformFeePaise + s.astrologerEarningPaise, s.amountChargedPaise)
  assert.equal(getWallet(ids.u1).balancePaise, PRICE * 7)
  assert.equal(getDb().walletTxs.filter(t => t.userId === ids.u1 && t.referenceType === 'session').length, 3)
  assert.equal(freshBusy(), false)
})
const freshBusy = () => getDb().astrologers.find(a => a.id === astroId)!.isBusy

test('ending in the first minute still costs one minute; ending twice is refused', () => {
  reset(); getWallet(ids.u1).balancePaise = 0; fund('u1', PRICE * 5); usedFree('u1')
  const u1 = getDb().users.find(u => u.id === ids.u1)!
  const s = S.createSession(u1, { astrologerSlug: slug, birthProfileId: bp.u1 }, T0); S.acceptSession(ids.ast, s.id, T0)
  S.endByParticipant(ids.ast, s.id, T0 + 5_000)
  assert.equal(s.amountChargedPaise, PRICE); assert.equal(s.endReason, 'astrologer')
  assert.throws(() => S.endByParticipant(ids.u1, s.id, T0 + 6_000), (e: any) => e.code === 'NOT_ACTIVE')
  assert.throws(() => S.endByParticipant(ids.other, s.id, T0 + 6_000), (e: any) => e.code === 'FORBIDDEN')
})

test('balance runs out: chat ends exactly at the end of the paid minute', () => {
  reset(); getWallet(ids.u1).balancePaise = 0; fund('u1', PRICE * 5); usedFree('u1')
  const u1 = getDb().users.find(u => u.id === ids.u1)!
  const s = S.createSession(u1, { astrologerSlug: slug, birthProfileId: bp.u1 }, T0); S.acceptSession(ids.ast, s.id, T0); S.markPresent(s.id, 'sock', T0)
  getWallet(ids.u1).balancePaise = PRICE // enough for exactly one more minute
  S.tick(T0 + 60_000); assert.equal(s.status, 'active'); assert.equal(s.billedMinutes, 2)
  S.tick(T0 + 125_000)
  assert.equal(s.status, 'ended'); assert.equal(s.endReason, 'balance')
  assert.equal(s.durationSeconds, 120); assert.equal(s.amountChargedPaise, PRICE * 2)
  assert.equal(getWallet(ids.u1).balancePaise, 0)
})

test('free chat: once per user, capped, no charge, and survives account deletion', () => {
  reset()
  const id = mkUser('f1', '+919100000010'); const f1 = getDb().users.find(u => u.id === id)!
  assert.equal(S.freeChatAvailable(f1), true)
  const s = S.createSession(f1, { astrologerSlug: slug, birthProfileId: bp.f1 }, T0)
  assert.equal(s.isFree, true)
  S.acceptSession(ids.ast, s.id, T0); S.markPresent(s.id, 'sock', T0)
  assert.equal(f1.freeChatUsed, true); assert.equal(getWallet(id).balancePaise, 0)
  S.tick(T0 + 299_000); assert.equal(s.status, 'active')
  S.tick(T0 + 301_000); assert.equal(s.status, 'ended'); assert.equal(s.endReason, 'free_limit'); assert.equal(s.durationSeconds, 300)
  assert.equal(s.amountChargedPaise, 0); assert.equal(s.platformFeePaise, 0)
  assert.equal(S.freeChatAvailable(f1), false)
  assert.throws(() => S.createSession(f1, { astrologerSlug: slug, birthProfileId: bp.f1 }, T0 + 400_000), (e: any) => e.code === 'INSUFFICIENT_BALANCE')
  // delete and "re-register" with the same number
  getDb().sessions.length = 0
  deleteAccount(id)
  const id2 = mkUser('f1b', '+919100000010'); const again = getDb().users.find(u => u.id === id2)!
  assert.equal(again.freeChatUsed, false); assert.equal(S.freeChatAvailable(again), false)
})

test('an unaccepted free request does not use up the free chat', () => {
  reset()
  const id = mkUser('f2', '+919100000011'); const f2 = getDb().users.find(u => u.id === id)!
  const s = S.createSession(f2, { astrologerSlug: slug, birthProfileId: bp.f2 }, T0)
  S.rejectSession(ids.ast, s.id, T0 + 1000)
  assert.equal(s.status, 'rejected'); assert.equal(S.freeChatAvailable(f2), true)
})

test('both sides offline for 60 seconds ends the chat; restart recovery closes open chats', () => {
  reset(); getWallet(ids.u1).balancePaise = 0; fund('u1', PRICE * 5); usedFree('u1')
  const u1 = getDb().users.find(u => u.id === ids.u1)!
  const s = S.createSession(u1, { astrologerSlug: slug, birthProfileId: bp.u1 }, T0); S.acceptSession(ids.ast, s.id, T0)
  S.markPresent(s.id, 'sock1', T0 + 10_000)
  S.tick(T0 + 50_000); assert.equal(s.status, 'active', 'someone is connected')
  S.markAbsent(s.id, 'sock1', T0 + 55_000)
  S.tick(T0 + 100_000); assert.equal(s.status, 'active', 'inside the grace period')
  S.tick(T0 + 116_000); assert.equal(s.status, 'ended'); assert.equal(s.endReason, 'disconnected')

  reset(); getWallet(ids.u1).balancePaise = 0; fund('u1', PRICE * 5)
  const s2 = S.createSession(u1, { astrologerSlug: slug, birthProfileId: bp.u1 }, T0); S.acceptSession(ids.ast, s2.id, T0)
  assert.equal(S.recoverSessions(T0 + 30_000), 1)
  assert.equal(s2.status, 'ended'); assert.equal(s2.endReason, 'server_restart'); assert.equal(freshBusy(), false)
})

test('messages: only participants, only while active, length limits; astrologer never sees the phone', () => {
  reset(); getWallet(ids.u1).balancePaise = 0; fund('u1', PRICE * 5); usedFree('u1')
  const u1 = getDb().users.find(u => u.id === ids.u1)!
  const s = S.createSession(u1, { astrologerSlug: slug, birthProfileId: bp.u1 }, T0)
  assert.throws(() => S.sendMessage(ids.u1, s.id, 'hi', T0), (e: any) => e.code === 'NOT_ACTIVE')
  S.acceptSession(ids.ast, s.id, T0)
  S.sendMessage(ids.u1, s.id, '  Hello  ', T0 + 1000); S.sendMessage(ids.ast, s.id, 'Namaste', T0 + 2000)
  assert.throws(() => S.sendMessage(ids.other, s.id, 'hi', T0), (e: any) => e.code === 'FORBIDDEN')
  assert.throws(() => S.sendMessage(ids.u1, s.id, '   ', T0), (e: any) => e.code === 'VALIDATION')
  assert.throws(() => S.sendMessage(ids.u1, s.id, 'x'.repeat(2001), T0), (e: any) => e.code === 'VALIDATION')
  const chat = S.messagesOf(s).filter(m => m.senderRole !== 'system')
  assert.deepEqual(chat.map(m => [m.senderRole, m.body]), [['user', 'Hello'], ['astrologer', 'Namaste']])
  const view = JSON.stringify(S.sessionView(s, 'astrologer'))
  assert.ok(!view.includes('+9191'), 'no phone number in the astrologer view'); assert.ok(!view.includes('amountChargedPaise'))
  assert.ok(view.includes('astrologerEarningPaise'))
  S.endByParticipant(ids.u1, s.id, T0 + 3000)
  assert.throws(() => S.sendMessage(ids.u1, s.id, 'late', T0 + 4000), (e: any) => e.code === 'NOT_ACTIVE')
})

test('reviews: once, after the chat; 1-2 stars flag a refund; refund is admin only and once', async () => {
  reset(); getWallet(ids.u1).balancePaise = 0; fund('u1', PRICE * 5); usedFree('u1')
  const u1 = getDb().users.find(u => u.id === ids.u1)!
  const s = S.createSession(u1, { astrologerSlug: slug, birthProfileId: bp.u1 }, T0); S.acceptSession(ids.ast, s.id, T0)
  assert.throws(() => S.reviewSession(ids.u1, s.id, 5, '', T0), (e: any) => e.code === 'NOT_ENDED')
  S.endByParticipant(ids.u1, s.id, T0 + 10_000)
  assert.throws(() => S.reviewSession(ids.other, s.id, 5, '', T0), (e: any) => e.code === 'FORBIDDEN')
  S.reviewSession(ids.u1, s.id, 2, 'Not helpful', T0)
  assert.equal(s.refundStatus, 'flagged')
  assert.throws(() => S.reviewSession(ids.u1, s.id, 5, '', T0), (e: any) => e.code === 'ALREADY_REVIEWED')
  assert.equal((await call('u1', 'POST', `/admin/sessions/${s.id}/refund`, { amountPaise: PRICE, reason: 'low rating review' })).status, 403)
  getDb().users.find(u => u.id === ids.ast)!.role = 'admin'; tok.ast = signAccess(ids.ast, 'admin')
  const before = getWallet(ids.u1).balancePaise
  assert.equal((await call('ast', 'POST', `/admin/sessions/${s.id}/refund`, { amountPaise: PRICE * 2, reason: 'too much' })).status, 400)
  assert.equal((await call('ast', 'POST', `/admin/sessions/${s.id}/refund`, { amountPaise: PRICE, reason: 'low rating review' })).status, 200)
  assert.equal(getWallet(ids.u1).balancePaise, before + PRICE)
  assert.equal((await call('ast', 'POST', `/admin/sessions/${s.id}/refund`, { amountPaise: PRICE, reason: 'again please' })).status, 409)
  assert.equal(getWallet(ids.u1).balancePaise, before + PRICE, 'no double refund')
  getDb().users.find(u => u.id === ids.ast)!.role = 'astrologer'; tok.ast = signAccess(ids.ast, 'astrologer')
})

test('HTTP: status, request, accept, history, and permission checks', async () => {
  reset(); getWallet(ids.u1).balancePaise = 0; fund('u1', PRICE * 5); usedFree('u1')
  let r = await call('u1', 'GET', '/sessions/status'); assert.equal(r.json.data.freeChatAvailable, false); assert.equal(r.json.data.balancePaise, PRICE * 5)
  r = await call('u1', 'POST', '/sessions', { astrologerSlug: slug, birthProfileId: bp.u1 }); assert.equal(r.status, 201)
  const id = r.json.data.session.id
  assert.equal((await call('other', 'GET', `/sessions/${id}`)).status, 403)
  assert.equal((await call('u1', 'POST', `/sessions/${id}/accept`)).status, 403, 'a user cannot accept')
  r = await call('ast', 'GET', '/sessions/incoming'); assert.equal(r.json.data.items[0].id, id); assert.equal(r.json.data.items[0].birth.name, 'u1')
  assert.equal((await call('ast', 'POST', `/sessions/${id}/accept`)).status, 200)
  assert.equal((await call('ast', 'PATCH', '/astrologers/me/status', { isOnline: false })).status, 409, 'cannot go offline mid-chat')
  assert.equal((await call('u1', 'POST', `/sessions/${id}/end`)).status, 200)
  r = await call('u1', 'GET', '/sessions/mine'); assert.equal(r.json.data.items[0].status, 'ended')
  r = await call('u1', 'POST', `/sessions/${id}/review`, { rating: 5, comment: 'Clear and kind' }); assert.equal(r.status, 201)
  assert.equal((await call('u1', 'POST', `/sessions/${id}/review`, { rating: 6 })).status, 400)
  const unauth = await fetch(base + '/api/v1/sessions/mine'); assert.equal(unauth.status, 401)
})

test('Socket.IO: auth, join, live messages both ways, typing, and end event', async () => {
  reset(); getWallet(ids.u1).balancePaise = 0; fund('u1', PRICE * 5); usedFree('u1')
  const u1 = getDb().users.find(u => u.id === ids.u1)!
  const s = S.createSession(u1, { astrologerSlug: slug, birthProfileId: bp.u1 }, Date.now())
  const open = (who: string): Promise<Socket> => new Promise((res, rej) => { const c = connect(base, { auth: { token: tok[who] }, transports: ['websocket'], reconnection: false }); c.on('connect', () => res(c)); c.on('connect_error', rej) })
  await assert.rejects(new Promise((res, rej) => { const c = connect(base, { auth: { token: 'bad' }, transports: ['websocket'], reconnection: false }); c.on('connect', () => res(true)); c.on('connect_error', e => { c.close(); rej(e) }) }), /UNAUTHORIZED/)
  const user = await open('u1'), ast = await open('ast'), intruder = await open('other')
  const ack = (c: Socket, ev: string, p: unknown) => new Promise<any>(r => c.emit(ev, p, r))
  assert.equal((await ack(intruder, 'session:join', { sessionId: s.id })).ok, false)
  const gotUpdate = new Promise<any>(r => user.once('session:update', r))
  S.acceptSession(ids.ast, s.id)
  assert.equal((await gotUpdate).status, 'active')
  const j1 = await ack(user, 'session:join', { sessionId: s.id }), j2 = await ack(ast, 'session:join', { sessionId: s.id })
  assert.equal(j1.ok, true); assert.equal(j1.session.viewerRole, 'user'); assert.equal(j2.session.viewerRole, 'astrologer')
  const atAst = new Promise<any>(r => ast.once('message:new', r)), typing = new Promise<any>(r => ast.once('typing', r))
  user.emit('typing', { sessionId: s.id, on: true })
  assert.deepEqual(await typing, { role: 'user', on: true })
  assert.equal((await ack(user, 'message:send', { sessionId: s.id, body: 'Hello' })).ok, true)
  assert.equal((await atAst).body, 'Hello')
  const atUser = new Promise<any>(r => user.once('message:new', r))
  await ack(ast, 'message:send', { sessionId: s.id, body: 'Namaste' })
  assert.equal((await atUser).senderRole, 'astrologer')
  assert.equal((await ack(intruder, 'message:send', { sessionId: s.id, body: 'hack' })).ok, false)
  const ended = new Promise<any>(r => ast.on('session:update', (v: any) => { if (v.status === 'ended') r(v) }))
  assert.equal((await ack(user, 'session:end', { sessionId: s.id })).ok, true)
  assert.equal((await ended).endReason, 'user')
  user.close(); ast.close(); intruder.close()
})
