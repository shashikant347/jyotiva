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
const { parseCsv } = await import('./csv.js')
const { parseHoroscopeCsv, defaultDateTo, TEMPLATE_CSV } = await import('./import.js')

let srv: Server, base = ''
let adminTok = '', userTok = ''
const HEAD = 'sign,period,category,language,date_from,date_to,text,lucky_number,lucky_color,mood,love_score,career_score,health_score,money_score\n'

before(() => {
  const mk = (role: 'admin' | 'user') => {
    const id = newId(), iso = new Date().toISOString()
    getDb().users.push({ id, phone: '+91' + (role === 'admin' ? '9000000001' : '9000000002'), email: null, name: '', gender: null, photoUrl: null, language: 'en', theme: 'auto', role, freeChatUsed: false, createdAt: iso, updatedAt: iso, deletedAt: null })
    return signAccess(id, role)
  }
  adminTok = mk('admin'); userTok = mk('user')
  srv = createApp().listen(0)
  base = `http://localhost:${(srv.address() as { port: number }).port}/api/v1`
})
after(() => { srv.close() })

const call = (p: string, init: { method?: string; token?: string; body?: unknown } = {}) =>
  fetch(base + p, { method: init.method ?? 'GET', headers: { 'Content-Type': 'application/json', ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}) }, body: init.body === undefined ? undefined : JSON.stringify(init.body) }).then(async r => ({ status: r.status, json: (await r.json().catch(() => null)) as any }))

test('CSV parser handles quotes, commas, newlines, CRLF and BOM', () => {
  const rows = parseCsv('\uFEFFa,b,c\r\n1,"x, y","line1\nline2"\r\n"he said ""hi""",,3\r\n')
  assert.deepEqual(rows, [['a', 'b', 'c'], ['1', 'x, y', 'line1\nline2'], ['he said "hi"', '', '3']])
  assert.throws(() => parseCsv('a,"b'), /Unclosed/)
})

test('default end dates', () => {
  assert.equal(defaultDateTo('daily', '2026-11-17'), '2026-11-17')
  assert.equal(defaultDateTo('weekly', '2026-11-16'), '2026-11-22')
  assert.equal(defaultDateTo('monthly', '2026-02-01'), '2026-02-28')
  assert.equal(defaultDateTo('yearly', '2027-01-01'), '2027-12-31')
})

test('row validation reports the row number and reason', () => {
  const r = parseHoroscopeCsv(HEAD + 'Aries,daily,,,2026-11-17,,Good day,7,Red,Calm,4,3,4,5\nLeo,daily,,,2026-13-40,,x,,,,,,,\nVirgo,daily,,,2026-11-17,,x,,,,9,,,\nFoo,daily,,,2026-11-17,,x,,,,,,,\nAries,daily,,,2026-11-17,,dup,,,,,,,\nLibra,weekly,,,2026-11-16,2026-12-30,x,,,,,,,\n')
  assert.equal(r.rows.length, 1)
  assert.equal(r.rows[0].category, 'general'); assert.equal(r.rows[0].language, 'en'); assert.equal(r.rows[0].dateTo, '2026-11-17')
  assert.deepEqual(r.errors.map(e => e.row), [3, 4, 5, 6, 7])
  assert.match(r.errors[0].message, /date_from/); assert.match(r.errors[1].message, /1 to 5/); assert.match(r.errors[2].message, /Unknown sign/); assert.match(r.errors[3].message, /Duplicate/); assert.match(r.errors[4].message, /at most 7/)
})

test('header problems are rejected', () => {
  assert.match(parseHoroscopeCsv('sign,text\nAries,x').errors[0].message, /Missing column/)
  assert.match(parseHoroscopeCsv(HEAD.trim() + ',bogus\n').errors[0].message, /Unknown column/)
  assert.ok(parseHoroscopeCsv(TEMPLATE_CSV).errors.length === 0)
})

test('admin endpoints require an admin', async () => {
  assert.equal((await call('/admin/horoscopes')).status, 401)
  assert.equal((await call('/admin/horoscopes', { token: userTok })).status, 403)
  assert.equal((await call('/admin/horoscopes/import', { method: 'POST', token: userTok, body: { csv: HEAD } })).status, 403)
  assert.equal((await call('/admin/horoscopes', { token: adminTok })).status, 200)
})

test('import is all-or-nothing, drafts are hidden, publishing exposes them', async () => {
  const bad = await call('/admin/horoscopes/import', { method: 'POST', token: adminTok, body: { csv: HEAD + 'Aries,daily,,,2026-11-17,,Fine,,,,,,,\nNope,daily,,,2026-11-17,,x,,,,,,,\n' } })
  assert.equal(bad.json.data.applied, false); assert.equal(bad.json.data.errors[0].row, 3)
  assert.equal(getDb().horoscopes.length, 0)

  const csv = HEAD + 'Aries,daily,general,en,2026-11-17,,"Original draft text, with a comma.",7,Red,Calm,4,3,4,5\nAries,daily,love,en,2026-11-17,,Love text,,,,5,,,\nAries,weekly,general,en,2026-11-16,,Week text,,,,,,,\n'
  const imp = await call('/admin/horoscopes/import', { method: 'POST', token: adminTok, body: { csv } })
  assert.deepEqual([imp.json.data.created, imp.json.data.updated, imp.json.data.status], [3, 0, 'draft'])

  assert.equal((await call('/horoscope/daily/aries?date=2026-11-17')).status, 404) // draft is private
  assert.equal((await call('/admin/horoscopes/publish', { method: 'POST', token: adminTok, body: { period: 'daily', dateFrom: '2026-11-17', status: 'published' } })).json.data.changed, 2)

  const g = await call('/horoscope/daily/aries?date=2026-11-17')
  assert.equal(g.status, 200)
  assert.equal(g.json.data.text, 'Original draft text, with a comma.')
  assert.deepEqual(g.json.data.scores, { love: 4, career: 3, health: 4, money: 5 })
  assert.equal((await call('/horoscope/daily/aries?date=2026-11-17&category=love')).json.data.text, 'Love text')
  assert.equal((await call('/horoscope/daily/aries?date=2026-11-18')).status, 404) // wrong day
  assert.equal((await call('/horoscope/weekly/aries?date=2026-11-17')).status, 404) // weekly still a draft

  const all = await call('/horoscope/daily?date=2026-11-17')
  assert.equal(all.json.data.items.length, 1)

  // re-import updates in place and keeps the published state of untouched rows
  const re = await call('/admin/horoscopes/import', { method: 'POST', token: adminTok, body: { csv: HEAD + 'Aries,daily,general,en,2026-11-17,,Edited,,,,,,,\n', publish: true } })
  assert.deepEqual([re.json.data.created, re.json.data.updated], [0, 1])
  assert.equal((await call('/horoscope/daily/aries?date=2026-11-17')).json.data.text, 'Edited')
  assert.equal(getDb().horoscopes.length, 3)
})

test('language falls back to English and unknown inputs 404/400', async () => {
  const h = await call('/horoscope/daily/aries?date=2026-11-17&lang=hi')
  assert.equal(h.json.data.language, 'en'); assert.equal(h.json.data.languageFallback, true)
  assert.equal((await call('/horoscope/hourly/aries')).status, 404)
  assert.equal((await call('/horoscope/daily/zzz')).status, 404)
  assert.equal((await call('/horoscope/daily/aries?lang=fr')).status, 400)
})

test('large CSV bodies are accepted on the admin route only', async () => {
  const big = HEAD + 'Aries,daily,,,2026-12-01,,' + 'x'.repeat(60_000) + ',,,,,,,\n'
  const r = await call('/admin/horoscopes/import', { method: 'POST', token: adminTok, body: { csv: big, dryRun: true } })
  assert.equal(r.status, 200); assert.ok(r.json.data.errors.length === 1) // too long text, but the body itself was accepted
  const t = await call('/tools/calc/love-calculator', { method: 'POST', body: { first: 'John', second: 'Jane', pad: 'x'.repeat(60_000) } })
  assert.equal(t.status, 413)
})
