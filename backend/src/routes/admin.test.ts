import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, before, test } from 'node:test'
import type { Server } from 'node:http'

process.env.DATA_FILE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'jv-')), 'db.json')
const { createApp } = await import('../app.js')
const { getDb, newId } = await import('../store.js')
const { signAccess } = await import('../auth/tokens.js')

let server: Server, base = ''
let adminToken = '', userToken = ''

interface AdminResponse {
  data: {
    metrics: {
      users: { total: number; newToday: number }
      astrologers: { approved: number; pending: number; online: number; demo: number }
      sessions: { total: number; active: number; endedToday: number; platformFeesPaise: number }
      payments: { paidTodayCount: number; paidTodayPaise: number; totalPaidPaise: number }
      openSupportTickets: number
      publishedHoroscopes: number
    }
    recentSessions: Array<{ id: string }>
    items: Array<{ name: string; phone: string; walletBalancePaise: number; email?: string; deletedAt: string | null }>
    total: number
    pages: number
  }
}

before(() => {
  const createUser = (role: 'admin' | 'user', phone: string, name: string, deletedAt: string | null = null) => {
    const id = newId(), now = new Date().toISOString()
    getDb().users.push({ id, phone, email: null, name, gender: null, photoUrl: null, language: 'en', theme: 'auto', role, freeChatUsed: false, createdAt: now, updatedAt: now, deletedAt })
    return signAccess(id, role)
  }
  adminToken = createUser('admin', '+919000000001', 'Admin')
  userToken = createUser('user', '+919000000002', 'Riya Sharma')
  createUser('user', '+919000000003', 'Deleted Riya', new Date().toISOString())

  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setUTCHours(0, 0, 0, 0)
  const old = new Date(todayStart.getTime() - 86400000).toISOString()
  const endedAt = now.getTime()
  const makeSession = (status: 'active' | 'ended', requestedAt: number, platformFeePaise: number) => ({
    id: newId(), userId: 'u', astrologerId: 'a', type: 'chat' as const, status, isFree: false, pricePerMinPaise: 100,
    birth: { name: 'Test', gender: 'other' as const, birthDate: '2000-01-01', birthTime: null, birthPlace: 'Delhi', latitude: null, longitude: null, timezone: 'Asia/Kolkata' },
    requestedAt, startedAt: requestedAt, endedAt: status === 'ended' ? endedAt : null, durationSeconds: 60, billedMinutes: 1,
    amountChargedPaise: 100, platformFeePaise, astrologerEarningPaise: 0, endReason: null, reviewId: null, refundStatus: 'none' as const, refundedPaise: 0,
  })
  const endedSession = makeSession('ended', endedAt - 1000, 75)
  getDb().sessions.push(endedSession, makeSession('active', endedAt, 99))
  getDb().astrologers.push(
    { id: 'real-approved', userId: 'u', slug: 'real-approved', displayName: 'Real', bio: '', experienceYears: 1, gender: 'other', languages: [], categories: [], skills: [], chatPricePaise: 100, callPricePaise: 100, status: 'approved', isOnline: true, isBusy: false, badge: null, isDemo: false, createdAt: old, updatedAt: old },
    { id: 'real-pending', userId: 'u', slug: 'real-pending', displayName: 'Pending', bio: '', experienceYears: 1, gender: 'other', languages: [], categories: [], skills: [], chatPricePaise: 100, callPricePaise: 100, status: 'pending', isOnline: false, isBusy: false, badge: null, isDemo: false, createdAt: old, updatedAt: old },
    { id: 'demo', userId: null, slug: 'demo', displayName: 'Demo', bio: '', experienceYears: 1, gender: 'other', languages: [], categories: [], skills: [], chatPricePaise: 100, callPricePaise: 100, status: 'approved', isOnline: true, isBusy: false, badge: null, isDemo: true, createdAt: old, updatedAt: old },
  )
  getDb().payments.push(
    { id: 'paid-today', userId: 'u', provider: 'mock', providerOrderId: 'today', providerPaymentId: 'p1', amountPaise: 2000, couponCode: null, bonusPaise: 0, status: 'paid', createdAt: now.toISOString(), paidAt: now.toISOString() },
    { id: 'paid-old', userId: 'u', provider: 'mock', providerOrderId: 'old', providerPaymentId: 'p2', amountPaise: 3000, couponCode: null, bonusPaise: 0, status: 'paid', createdAt: old, paidAt: old },
    { id: 'created', userId: 'u', provider: 'mock', providerOrderId: 'created', providerPaymentId: null, amountPaise: 5000, couponCode: null, bonusPaise: 0, status: 'created', createdAt: now.toISOString(), paidAt: null },
  )
  getDb().supportTickets.push(
    { id: 'open', userId: 'u', category: 'other', subject: 'Open ticket', status: 'open', relatedSessionId: null, createdAt: now.toISOString(), updatedAt: now.toISOString() },
    { id: 'pending', userId: 'u', category: 'other', subject: 'Pending ticket', status: 'pending', relatedSessionId: null, createdAt: now.toISOString(), updatedAt: now.toISOString() },
  )
  getDb().horoscopes.push({ id: 'published', sign: 0, period: 'daily', category: 'general', language: 'en', dateFrom: now.toISOString().slice(0, 10), dateTo: now.toISOString().slice(0, 10), text: 'Today', luckyNumber: null, luckyColor: null, mood: null, loveScore: null, careerScore: null, healthScore: null, moneyScore: null, status: 'published', createdAt: now.toISOString(), updatedAt: now.toISOString() })

  server = createApp().listen(0)
  base = `http://localhost:${(server.address() as { port: number }).port}/api/v1`
})
after(() => server.close())

const call = (token?: string, endpoint = '/admin/dashboard') => fetch(`${base}${endpoint}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }).then(async r => ({ status: r.status, json: await r.json() as AdminResponse }))

test('admin dashboard requires administrator access', async () => {
  assert.equal((await call()).status, 401)
  assert.equal((await call(userToken)).status, 403)
})

test('admin dashboard reports current operational metrics without counting deleted users or demo astrologers as real', async () => {
  const r = await call(adminToken)
  assert.equal(r.status, 200)
  const m = r.json.data.metrics
  assert.equal(m.users.total, 2)
  assert.equal(m.users.newToday, 2)
  assert.deepEqual(m.astrologers, { approved: 1, pending: 1, online: 1, demo: 1 })
  assert.deepEqual(m.sessions, { total: 2, active: 1, endedToday: 1, platformFeesPaise: 75 })
  assert.deepEqual(m.payments, { paidTodayCount: 1, paidTodayPaise: 2000, totalPaidPaise: 5000 })
  assert.equal(m.openSupportTickets, 1)
  assert.equal(m.publishedHoroscopes, 1)
  assert.deepEqual(r.json.data.recentSessions.map(s => s.id), getDb().sessions.slice().sort((a, b) => b.requestedAt - a.requestedAt).map(s => s.id))
})

test('admin user directory supports case-insensitive search, role filters, and opt-in deleted accounts', async () => {
  assert.equal((await call(undefined, '/admin/users')).status, 401)
  assert.equal((await call(userToken, '/admin/users')).status, 403)

  const found = await call(adminToken, '/admin/users?q=RIYA')
  assert.equal(found.status, 200)
  assert.equal(found.json.data.total, 1)
  assert.equal(found.json.data.items[0].name, 'Riya Sharma')
  assert.equal(found.json.data.items[0].phone, '+919000000002')
  assert.equal(found.json.data.items[0].walletBalancePaise, 0)
  assert.equal(found.json.data.items[0].email, undefined)

  const deleted = await call(adminToken, '/admin/users?q=Deleted&includeDeleted=true&role=user')
  assert.equal(deleted.json.data.total, 1)
  assert.equal(deleted.json.data.items.length, 1)
  assert.ok(deleted.json.data.items[0].deletedAt)
  const page = await call(adminToken, '/admin/users?role=user&includeDeleted=true&limit=1&page=2')
  assert.equal(page.json.data.total, 2)
  assert.equal(page.json.data.pages, 2)
  assert.equal(page.json.data.items.length, 1)
  assert.equal((await call(adminToken, '/admin/users?limit=101')).status, 400)
})
