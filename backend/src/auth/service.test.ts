import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'

process.env.DATA_FILE = path.join(os.tmpdir(), `jyotiva-test-${process.pid}.json`)
process.env.NODE_ENV = 'test'

const svc = await import('./service.js')
const { getDb } = await import('../store.js')
const { normalizePhone } = await import('./phone.js')

const ctx = { ip: '1.2.3.4', device: 'test' }
const realNow = Date.now
const setNow = (t: number) => { Date.now = () => t }
test.afterEach(() => { Date.now = realNow })

async function login(phone: string) {
  const { devOtp } = await svc.sendOtp(phone)
  assert.ok(devOtp, 'dev OTP is exposed outside production')
  return svc.verifyOtp(phone, devOtp, ctx)
}

test('phone normalisation', () => {
  assert.equal(normalizePhone('9876543210'), '+919876543210')
  assert.equal(normalizePhone('+91 98765-43210'), '+919876543210')
  assert.equal(normalizePhone('919876543210'), '+919876543210')
  assert.equal(normalizePhone('09876543210'), '+919876543210')
  assert.equal(normalizePhone('5876543210'), null) // must start 6-9
  assert.equal(normalizePhone('98765'), null)
  assert.equal(normalizePhone('abcdefghij'), null)
})

test('correct code logs in and creates the user once', async () => {
  const a = await login('+919000000001')
  assert.equal(a.isNewUser, true)
  setNow(Date.now() + 60_000)
  const b = await login('+919000000001')
  assert.equal(b.isNewUser, false)
  assert.equal(a.user.id, b.user.id)
})

test('wrong code is rejected, and a used code cannot be replayed', async () => {
  const phone = '+919000000002'
  const { devOtp } = await svc.sendOtp(phone)
  const wrong = devOtp === '000000' ? '000001' : '000000'
  await assert.rejects(svc.verifyOtp(phone, wrong, ctx), { code: 'INVALID_OTP' })
  await svc.verifyOtp(phone, devOtp!, ctx)
  await assert.rejects(svc.verifyOtp(phone, devOtp!, ctx), { code: 'INVALID_OTP' })
})

test('five wrong attempts lock the code, even if the right one follows', async () => {
  const phone = '+919000000003'
  const { devOtp } = await svc.sendOtp(phone)
  const wrong = devOtp === '000000' ? '000001' : '000000'
  for (let i = 0; i < 5; i++) await assert.rejects(svc.verifyOtp(phone, wrong, ctx), { code: 'INVALID_OTP' })
  await assert.rejects(svc.verifyOtp(phone, devOtp!, ctx), { code: 'OTP_LOCKED' })
})

test('codes expire after 5 minutes', async () => {
  const phone = '+919000000004'
  const { devOtp } = await svc.sendOtp(phone)
  setNow(Date.now() + 5 * 60_000 + 1)
  await assert.rejects(svc.verifyOtp(phone, devOtp!, ctx), { code: 'INVALID_OTP' })
})

test('resend cooldown and hourly cap', async () => {
  const phone = '+919000000005'
  const t0 = Date.now()
  await svc.sendOtp(phone)
  await assert.rejects(svc.sendOtp(phone), { code: 'OTP_COOLDOWN' })
  for (let i = 1; i < 5; i++) { setNow(t0 + i * 31_000); await svc.sendOtp(phone) }
  setNow(t0 + 5 * 31_000)
  await assert.rejects(svc.sendOtp(phone), { code: 'OTP_LIMIT' })
  setNow(t0 + 61 * 60_000) // window has passed
  await svc.sendOtp(phone)
})

test('a newer code invalidates the older one', async () => {
  const phone = '+919000000006'
  const first = await svc.sendOtp(phone)
  setNow(Date.now() + 31_000)
  const second = await svc.sendOtp(phone)
  if (first.devOtp !== second.devOtp) await assert.rejects(svc.verifyOtp(phone, first.devOtp!, ctx), { code: 'INVALID_OTP' })
  await svc.verifyOtp(phone, second.devOtp!, ctx)
})

test('refresh rotates the token; reusing the old one revokes the whole family', async () => {
  const s0 = await login('+919000000007')
  const s1 = svc.refresh(s0.refreshToken, ctx)
  assert.notEqual(s1.refreshToken, s0.refreshToken)
  assert.throws(() => svc.refresh(s0.refreshToken, ctx), { code: 'REFRESH_REUSED' }) // replayed
  assert.throws(() => svc.refresh(s1.refreshToken, ctx), { status: 401 }) // family dead
})

test('refresh tokens expire after 30 days', async () => {
  const s = await login('+919000000008')
  setNow(Date.now() + 30 * 24 * 3600 * 1000 + 1000)
  assert.throws(() => svc.refresh(s.refreshToken, ctx), { code: 'INVALID_REFRESH' })
})

test('logout kills the session', async () => {
  const s = await login('+919000000009')
  svc.logout(s.refreshToken)
  assert.throws(() => svc.refresh(s.refreshToken, ctx), { status: 401 })
  svc.logout(s.refreshToken) // idempotent
  svc.logout('not-a-real-token')
})

test('delete account erases personal data and frees the number', async () => {
  const phone = '+919000000010'
  const s = await login(phone)
  const db = getDb()
  db.birthProfiles.push({ id: 'bp1', userId: s.user.id, name: 'X', gender: 'male', birthDate: '1990-01-01', birthTime: null, birthPlace: 'Delhi', latitude: null, longitude: null, timezone: 'Asia/Kolkata', isPrimary: true, createdAt: new Date().toISOString() })
  svc.deleteAccount(s.user.id)
  assert.equal(db.birthProfiles.some(b => b.userId === s.user.id), false)
  assert.equal(db.refreshTokens.some(t => t.userId === s.user.id), false)
  assert.throws(() => svc.refresh(s.refreshToken, ctx), { status: 401 })
  const row = db.users.find(u => u.id === s.user.id)!
  assert.ok(row.deletedAt)
  assert.ok(!row.phone.includes('9000000010'))
  setNow(Date.now() + 60_000)
  const again = await login(phone)
  assert.equal(again.isNewUser, true)
  assert.notEqual(again.user.id, s.user.id)
})

test('a new account starts with the visitor\'s language and theme', async () => {
  const phone = '+919000000011'
  const { devOtp } = await svc.sendOtp(phone)
  const s = await svc.verifyOtp(phone, devOtp!, ctx, { language: 'hi', theme: 'dark' })
  assert.equal(s.user.language, 'hi')
  assert.equal(s.user.theme, 'dark')
})
