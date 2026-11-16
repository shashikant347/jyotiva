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
const { seedSampleBlog } = await import('../blog/seed.js')
const { deleteAccount } = await import('../auth/service.js')

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
  seedSampleBlog()
  srv = createApp().listen(0)
  base = `http://localhost:${(srv.address() as { port: number }).port}/api/v1`
})
after(() => { srv.close() })

const call = (p: string, o: { method?: string; token?: string; body?: unknown } = {}) =>
  fetch(base + p, { method: o.method ?? 'GET', headers: { 'Content-Type': 'application/json', ...(o.token ? { Authorization: `Bearer ${o.token}` } : {}) }, body: o.body === undefined ? undefined : JSON.stringify(o.body) }).then(async r => ({ status: r.status, json: (await r.json().catch(() => null)) as any }))

const ticket = { category: 'payment', subject: 'Money not added', message: 'I paid but my wallet balance did not change.' }

test('support: sign-in required, validation, create and read back', async () => {
  assert.equal((await call('/support/tickets')).status, 401)
  assert.equal((await call('/support/tickets', { method: 'POST', token: tok.u1, body: { ...ticket, message: 'short' } })).status, 400)
  assert.equal((await call('/support/tickets', { method: 'POST', token: tok.u1, body: { ...ticket, extra: 1 } })).status, 400)
  const r = await call('/support/tickets', { method: 'POST', token: tok.u1, body: ticket })
  assert.equal(r.status, 201); assert.equal(r.json.data.status, 'open')
  const id = r.json.data.id
  const d = await call(`/support/tickets/${id}`, { token: tok.u1 })
  assert.equal(d.json.data.messages.length, 1); assert.equal(d.json.data.messages[0].senderRole, 'user')
  assert.equal((await call('/support/tickets', { token: tok.u1 })).json.data.items.length, 1)
})

test('support: other users cannot see or write to a ticket', async () => {
  const id = (await call('/support/tickets', { token: tok.u1 })).json.data.items[0].id
  assert.equal((await call(`/support/tickets/${id}`, { token: tok.u2 })).status, 404)
  assert.equal((await call(`/support/tickets/${id}/messages`, { method: 'POST', token: tok.u2, body: { body: 'hi' } })).status, 404)
  assert.equal((await call('/support/tickets', { token: tok.u2 })).json.data.items.length, 0)
  assert.equal((await call('/support/tickets', { method: 'POST', token: tok.u2, body: { ...ticket, relatedSessionId: 'not-mine' } })).status, 400)
})

test('support: admin reply sets pending, user reply reopens, close blocks new messages', async () => {
  const id = (await call('/support/tickets', { token: tok.u1 })).json.data.items[0].id
  assert.equal((await call('/admin/support/tickets', { token: tok.u1 })).status, 403)
  const list = await call('/admin/support/tickets?status=open', { token: tok.admin })
  assert.equal(list.json.data.items.length, 1); assert.equal(list.json.data.items[0].userPhone, '+919000000002')
  assert.equal((await call(`/admin/support/tickets/${id}/messages`, { method: 'POST', token: tok.admin, body: { body: 'We are checking.' } })).status, 201)
  assert.equal((await call(`/support/tickets/${id}`, { token: tok.u1 })).json.data.ticket.status, 'pending')
  await call(`/support/tickets/${id}/messages`, { method: 'POST', token: tok.u1, body: { body: 'Any update?' } })
  assert.equal((await call(`/support/tickets/${id}`, { token: tok.u1 })).json.data.ticket.status, 'open')
  await call(`/support/tickets/${id}/close`, { method: 'POST', token: tok.u1 })
  assert.equal((await call(`/support/tickets/${id}/messages`, { method: 'POST', token: tok.u1, body: { body: 'again' } })).status, 409)
})

test('support: at most 5 unresolved tickets per user', async () => {
  for (let i = 0; i < 5; i++) assert.equal((await call('/support/tickets', { method: 'POST', token: tok.u2, body: ticket })).status, 201)
  assert.equal((await call('/support/tickets', { method: 'POST', token: tok.u2, body: ticket })).status, 429)
})

test('account deletion removes the user\'s tickets and messages', () => {
  const before = getDb().supportTickets.filter(t => t.userId === ids.u2).length
  assert.ok(before > 0)
  deleteAccount(ids.u2)
  assert.equal(getDb().supportTickets.filter(t => t.userId === ids.u2).length, 0)
  assert.equal(getDb().supportMessages.filter(m => !getDb().supportTickets.some(t => t.id === m.ticketId)).length, 0)
})

test('blog: public list and article show only published posts', async () => {
  const r = await call('/blog')
  assert.equal(r.json.data.total, 3); assert.ok(r.json.data.categories.includes('Panchang'))
  assert.equal(r.json.data.items[0].body, undefined)
  const a = await call('/blog/what-is-a-kundli')
  assert.equal(a.status, 200); assert.ok(a.json.data.post.body.length > 200); assert.equal(a.json.data.post.isSample, true)
  assert.equal((await call('/blog/nope')).status, 404)
  assert.equal((await call('/blog?category=Panchang')).json.data.total, 1)
  assert.equal((await call('/blog?q=horoscope')).json.data.total, 1)
})

test('blog: admin create, unique slug, draft hidden, publish, edit keeps date, delete', async () => {
  const post = { title: 'Saturn transit in 2027', excerpt: 'What the Saturn transit means for each sign.', body: 'x'.repeat(80), category: 'Transit', tags: ['saturn'], authorName: 'Editor' }
  assert.equal((await call('/admin/blog', { method: 'POST', token: tok.u1, body: post })).status, 403)
  assert.equal((await call('/admin/blog', { method: 'POST', token: tok.admin, body: { ...post, body: 'too short' } })).status, 400)
  const a = await call('/admin/blog', { method: 'POST', token: tok.admin, body: post })
  assert.equal(a.status, 201); assert.equal(a.json.data.slug, 'saturn-transit-in-2027'); assert.equal(a.json.data.status, 'draft')
  const b = await call('/admin/blog', { method: 'POST', token: tok.admin, body: post })
  assert.equal(b.json.data.slug, 'saturn-transit-in-2027-2')
  assert.equal((await call('/blog/saturn-transit-in-2027')).status, 404)
  const id = a.json.data.id
  const p = await call(`/admin/blog/${id}`, { method: 'PATCH', token: tok.admin, body: { ...post, status: 'published' } })
  assert.equal(p.status, 200); assert.ok(p.json.data.publishedAt)
  assert.equal((await call('/blog/saturn-transit-in-2027')).status, 200)
  const date = p.json.data.publishedAt
  const e = await call(`/admin/blog/${id}`, { method: 'PATCH', token: tok.admin, body: { ...post, title: 'Saturn transit 2027 guide', status: 'published' } })
  assert.equal(e.json.data.publishedAt, date)
  assert.equal((await call(`/admin/blog/${id}`, { method: 'DELETE', token: tok.admin })).status, 200)
  assert.equal((await call('/blog/saturn-transit-in-2027')).status, 404)
})
