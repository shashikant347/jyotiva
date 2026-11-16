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
const { seedDemoAstrologers } = await import('./seed.js')
const { slugify } = await import('./data.js')

let srv: Server, base = ''
const tok: Record<string, string> = {}
const ids: Record<string, string> = {}

before(() => {
  const mk = (name: string, role: 'admin' | 'user', phone: string) => {
    const id = newId(), iso = new Date().toISOString()
    getDb().users.push({ id, phone, email: null, name, gender: null, photoUrl: null, language: 'en', theme: 'auto', role, freeChatUsed: false, createdAt: iso, updatedAt: iso, deletedAt: null })
    ids[name] = id; tok[name] = signAccess(id, role)
  }
  mk('admin', 'admin', '+919000000001'); mk('u1', 'user', '+919000000002'); mk('u2', 'user', '+919000000003')
  seedDemoAstrologers()
  srv = createApp().listen(0)
  base = `http://localhost:${(srv.address() as { port: number }).port}/api/v1`
})
after(() => { srv.close() })

const call = (p: string, o: { method?: string; token?: string; body?: unknown } = {}) =>
  fetch(base + p, { method: o.method ?? 'GET', headers: { 'Content-Type': 'application/json', ...(o.token ? { Authorization: `Bearer ${o.token}` } : {}) }, body: o.body === undefined ? undefined : JSON.stringify(o.body) }).then(async r => ({ status: r.status, json: (await r.json().catch(() => null)) as any }))

const application = { displayName: 'Real Person', bio: 'I have twelve years of experience reading charts.', experienceYears: 12, gender: 'female', languages: ['en', 'hi'], categories: ['career'], skills: ['vedic'], chatPriceRupees: 30, callPriceRupees: 40 }

test('slugify', () => { assert.equal(slugify('  Pt. Ánand  Verma! '), 'pt-anand-verma'); assert.equal(slugify('!!!'), 'astrologer') })

test('seed is idempotent and demo profiles are flagged, without fake ratings', async () => {
  assert.equal(seedDemoAstrologers(), 0)
  const r = await call('/astrologers?limit=50')
  assert.equal(r.json.data.total, 6)
  for (const a of r.json.data.items) { assert.equal(a.isDemo, true); assert.equal(a.ratingAvg, null); assert.equal(a.ratingCount, 0) }
})

test('filters, sort and pagination', async () => {
  const q = async (s: string) => (await call('/astrologers?' + s)).json.data
  assert.ok((await q('category=love')).items.every((a: any) => a.categories.includes('love')))
  assert.equal((await q('language=pa')).total, 2)
  assert.ok((await q('gender=female')).items.every((a: any) => a.gender === 'female'))
  assert.ok((await q('online=true')).items.every((a: any) => a.status === 'online'))
  assert.ok((await q('minExperience=15')).items.every((a: any) => a.experienceYears >= 15))
  assert.ok((await q('maxPrice=2000')).items.every((a: any) => a.chatPricePaise <= 2000))
  assert.ok((await q('mode=call&maxPrice=2200')).items.every((a: any) => a.callPricePaise <= 2200))
  const low = (await q('sort=price-low')).items.map((a: any) => a.chatPricePaise)
  assert.deepEqual(low, [...low].sort((a, b) => a - b))
  const exp = (await q('sort=experience')).items.map((a: any) => a.experienceYears)
  assert.deepEqual(exp, [...exp].sort((a, b) => b - a))
  const p1 = await q('limit=4&page=1'), p2 = await q('limit=4&page=2')
  assert.equal(p1.items.length, 4); assert.equal(p2.items.length, 2); assert.equal(p1.total, 6)
  assert.equal((await q('q=astrologer%20c')).total, 1)
  assert.equal((await call('/astrologers?sort=bogus')).status, 400)
  assert.equal((await call('/astrologers?limit=500')).status, 400)
})

test('profile, similar and 404', async () => {
  const r = await call('/astrologers/demo-astrologer-a')
  assert.equal(r.status, 200); assert.equal(r.json.data.astrologer.displayName, 'Demo Astrologer A'); assert.ok(r.json.data.similar.length > 0)
  assert.equal(r.json.data.astrologer.userId, undefined) // internal ids are not exposed
  assert.equal((await call('/astrologers/nobody')).status, 404)
  assert.equal((await call('/astrologers/demo-astrologer-a/reviews')).json.data.total, 0)
})

test('categories endpoint', async () => {
  const r = await call('/astrologers/categories')
  assert.ok(r.json.data.categories.length > 5 && r.json.data.languages.length > 5)
})

test('application flow: validate, one per user, pending is hidden, approve makes it public', async () => {
  assert.equal((await call('/astrologers/apply', { method: 'POST', body: application })).status, 401)
  assert.equal((await call('/astrologers/apply', { method: 'POST', token: tok.u1, body: { ...application, chatPriceRupees: 1 } })).status, 400)
  assert.equal((await call('/astrologers/apply', { method: 'POST', token: tok.u1, body: { ...application, categories: ['nope'] } })).status, 400)
  assert.equal((await call('/astrologers/apply', { method: 'POST', token: tok.u1, body: { ...application, role: 'admin' } })).status, 400) // strict

  const a = await call('/astrologers/apply', { method: 'POST', token: tok.u1, body: application })
  assert.equal(a.status, 201); assert.equal(a.json.data.application.applicationStatus, 'pending')
  assert.equal(a.json.data.application.chatPricePaise, 3000)
  assert.equal((await call('/astrologers/apply', { method: 'POST', token: tok.u1, body: application })).status, 409)
  assert.equal((await call('/astrologers/real-person')).status, 404) // pending: not public
  assert.equal((await call('/astrologers?limit=50')).json.data.total, 6)

  const mine = await call('/astrologers/me/profile', { token: tok.u1 })
  assert.equal(mine.json.data.application.applicationStatus, 'pending')
  assert.equal((await call('/astrologers/me/profile', { token: tok.u2 })).json.data.application, null)
  assert.equal((await call('/astrologers/me/status', { method: 'PATCH', token: tok.u1, body: { isOnline: true } })).status, 403)

  // only admins may decide
  const rec = getDb().astrologers.find(x => x.userId === ids.u1)!
  assert.equal((await call(`/admin/astrologers/${rec.id}/status`, { method: 'POST', token: tok.u1, body: { status: 'approved' } })).status, 403)
  const list = await call('/admin/astrologers?status=pending', { token: tok.admin })
  assert.equal(list.json.data.total, 1)
  assert.equal((await call(`/admin/astrologers/${rec.id}/status`, { method: 'POST', token: tok.admin, body: { status: 'suspended' } })).status, 400)
  assert.equal((await call(`/admin/astrologers/${rec.id}/status`, { method: 'POST', token: tok.admin, body: { status: 'approved' } })).status, 200)
  assert.equal(getDb().users.find(u => u.id === ids.u1)!.role, 'astrologer')

  assert.equal((await call('/astrologers/real-person')).status, 200)
  assert.equal((await call('/astrologers?limit=50')).json.data.total, 7)
  const on = await call('/astrologers/me/status', { method: 'PATCH', token: tok.u1, body: { isOnline: true } })
  assert.equal(on.json.data.application.status, 'online')
  assert.equal((await call('/astrologers?online=true&limit=50')).json.data.items.some((x: any) => x.slug === 'real-person'), true)

  // suspend: hidden again, forced offline, role restored
  await call(`/admin/astrologers/${rec.id}/status`, { method: 'POST', token: tok.admin, body: { status: 'suspended' } })
  assert.equal((await call('/astrologers/real-person')).status, 404)
  assert.equal(rec.isOnline, false)
  assert.equal(getDb().users.find(u => u.id === ids.u1)!.role, 'user')
})

test('rejected applicants can re-apply; duplicate names get unique slugs', async () => {
  const a2 = await call('/astrologers/apply', { method: 'POST', token: tok.u2, body: application })
  assert.equal(a2.status, 201)
  assert.equal(a2.json.data.application.slug, 'real-person-2')
  const rec = getDb().astrologers.find(x => x.userId === ids.u2)!
  await call(`/admin/astrologers/${rec.id}/status`, { method: 'POST', token: tok.admin, body: { status: 'rejected' } })
  const again = await call('/astrologers/apply', { method: 'POST', token: tok.u2, body: { ...application, bio: 'Updated bio with more than twenty characters.' } })
  assert.equal(again.status, 201)
  assert.equal(getDb().astrologers.filter(x => x.userId === ids.u2).length, 1)
})

test('demo data can be removed', async () => {
  const r = await call('/admin/astrologers/demo', { method: 'DELETE', token: tok.admin })
  assert.equal(r.json.data.removed, 6)
  assert.equal(getDb().astrologers.some(a => a.isDemo), false)
})
