import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, before, test } from 'node:test'
import type { Server } from 'node:http'

process.env.DATA_FILE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'jv-')), 'db.json')
process.env.RAZORPAY_WEBHOOK_SECRET = 'whsec_test_secret_value'
const { createApp } = await import('../app.js')
const { config } = await import('../config.js')
const { getDb, newId } = await import('../store.js')
const { signAccess } = await import('../auth/tokens.js')
const { creditWallet, debitWallet, getWallet, couponBonus, createPayment, settlePayment } = await import('./service.js')
const { verifyCheckoutSignature, verifyWebhookSignature } = await import('./gateway.js')
const { deleteAccount } = await import('../auth/service.js')

let srv: Server, base = ''
const tok: Record<string, string> = {}, ids: Record<string, string> = {}
const hmac = (secret: string, data: string | Buffer) => crypto.createHmac('sha256', secret).update(data).digest('hex')

before(() => {
  const mk = (name: string, role: 'admin' | 'user', phone: string) => {
    const id = newId(), iso = new Date().toISOString()
    getDb().users.push({ id, phone, email: null, name, gender: null, photoUrl: null, language: 'en', theme: 'auto', role, freeChatUsed: false, createdAt: iso, updatedAt: iso, deletedAt: null })
    ids[name] = id; tok[name] = signAccess(id, role)
  }
  mk('admin', 'admin', '+919000000001'); mk('u1', 'user', '+919000000002'); mk('u2', 'user', '+919000000003')
  srv = createApp().listen(0)
  base = `http://localhost:${(srv.address() as { port: number }).port}/api/v1`
})
after(() => { srv.close() })

const call = (p: string, o: { method?: string; token?: string; body?: unknown } = {}) =>
  fetch(base + p, { method: o.method ?? 'GET', headers: { 'Content-Type': 'application/json', ...(o.token ? { Authorization: `Bearer ${o.token}` } : {}) }, body: o.body === undefined ? undefined : JSON.stringify(o.body) }).then(async r => ({ status: r.status, json: (await r.json().catch(() => null)) as any }))
const bal = async (t: string) => (await call('/wallet', { token: t })).json.data.balancePaise as number

test('wallet requires sign-in and starts at zero', async () => {
  assert.equal((await call('/wallet')).status, 401)
  const r = await call('/wallet', { token: tok.u1 })
  assert.equal(r.json.data.balancePaise, 0); assert.equal(r.json.data.gateway.mode, 'mock')
})

test('ledger: credits, debits, no overdraft, idempotent references', () => {
  const u = newId()
  creditWallet(u, 'recharge', 10000, 'payment', 'p1', 'x')
  assert.equal(getWallet(u).balancePaise, 10000)
  assert.equal(creditWallet(u, 'recharge', 10000, 'payment', 'p1', 'x').balanceAfterPaise, 10000) // duplicate event returns the first tx
  assert.equal(getWallet(u).balancePaise, 10000)
  debitWallet(u, 2500, 'session', 's1', 'chat')
  assert.equal(getWallet(u).balancePaise, 7500)
  assert.throws(() => debitWallet(u, 7501, 'session', 's2', 'chat'), /Not enough balance/)
  assert.equal(getWallet(u).balancePaise, 7500)
  assert.throws(() => creditWallet(u, 'bonus', 12.5, 'admin', 'a', ''), /integer/)
  assert.throws(() => creditWallet(u, 'bonus', -5, 'admin', 'a', ''), /positive/)
  const txs = getDb().walletTxs.filter(t => t.userId === u)
  assert.deepEqual(txs.map(t => t.balanceAfterPaise), [10000, 7500])
})

test('recharge validation', async () => {
  const r = (body: unknown) => call('/wallet/recharge', { method: 'POST', token: tok.u1, body })
  assert.equal((await r({ amountPaise: 500 })).status, 400) // under Rs 10
  assert.equal((await r({ amountPaise: 99_999_999 })).status, 400)
  assert.equal((await r({ amountPaise: 100.5 })).status, 400)
  assert.equal((await r({ amountPaise: 10000, extra: 1 })).status, 400)
  assert.equal((await call('/wallet/recharge', { method: 'POST', body: { amountPaise: 10000 } })).status, 401)
})

test('mock recharge credits once, even when paid twice at the same time', async () => {
  const c = await call('/wallet/recharge', { method: 'POST', token: tok.u1, body: { amountPaise: 50000 } })
  assert.equal(c.status, 201); assert.equal(c.json.data.provider, 'mock')
  const pid = c.json.data.paymentId
  assert.equal(await bal(tok.u1), 0) // creating an order does not credit
  const [a, b] = await Promise.all([1, 2].map(() => call('/wallet/recharge/mock-pay', { method: 'POST', token: tok.u1, body: { paymentId: pid } })))
  assert.equal(a.status, 200); assert.equal(b.status, 200)
  assert.equal(await bal(tok.u1), 50000)
  assert.equal(getDb().walletTxs.filter(t => t.referenceId === pid).length, 1)
  // another user cannot pay someone else's payment
  assert.equal((await call('/wallet/recharge/mock-pay', { method: 'POST', token: tok.u2, body: { paymentId: pid } })).status, 404)
  const tx = await call('/wallet/transactions', { token: tok.u1 })
  assert.equal(tx.json.data.total, 1); assert.equal(tx.json.data.items[0].type, 'recharge')
  assert.equal(tx.json.data.items[0].userId, undefined)
})

test('signature checks use the right inputs', () => {
  const secret = 'key_secret_value'
  const good = hmac(secret, 'order_1|pay_1')
  assert.equal(verifyCheckoutSignature('order_1', 'pay_1', good, secret), true)
  assert.equal(verifyCheckoutSignature('order_1', 'pay_2', good, secret), false)
  assert.equal(verifyCheckoutSignature('order_1', 'pay_1', '', secret), false)
  assert.equal(verifyCheckoutSignature('order_1', 'pay_1', good, ''), false) // no secret configured: never valid
  const body = Buffer.from('{"a":1}')
  assert.equal(verifyWebhookSignature(body, hmac('w', body), 'w'), true)
  assert.equal(verifyWebhookSignature(Buffer.from('{"a":2}'), hmac('w', body), 'w'), false)
})

test('browser confirm (Razorpay path) verifies the signature and is idempotent', async () => {
  const p = createPayment(ids.u2, 'razorpay', 'order_rzp_1', 20000, null, 0)
  config.razorpayKeySecret = 'key_secret_value' // mode stays "mock" because no key id; confirm only needs the secret
  const body = (sig: string) => ({ paymentId: p.id, razorpayOrderId: 'order_rzp_1', razorpayPaymentId: 'pay_rzp_1', razorpaySignature: sig })
  const bad = await call('/wallet/recharge/confirm', { method: 'POST', token: tok.u2, body: body('0'.repeat(64)) })
  assert.equal(bad.status, 400); assert.equal(await bal(tok.u2), 0)
  const mismatch = await call('/wallet/recharge/confirm', { method: 'POST', token: tok.u2, body: { ...body(hmac('key_secret_value', 'order_other|pay_rzp_1')), razorpayOrderId: 'order_other' } })
  assert.equal(mismatch.status, 400)
  const sig = hmac('key_secret_value', 'order_rzp_1|pay_rzp_1')
  assert.equal((await call('/wallet/recharge/confirm', { method: 'POST', token: tok.u2, body: body(sig) })).status, 200)
  assert.equal((await call('/wallet/recharge/confirm', { method: 'POST', token: tok.u2, body: body(sig) })).status, 200)
  assert.equal(await bal(tok.u2), 20000)
  config.razorpayKeySecret = ''
})

const webhook = (payload: unknown, secret = 'whsec_test_secret_value') => {
  const raw = JSON.stringify(payload)
  return fetch(base + '/payments/webhook/razorpay', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Razorpay-Signature': hmac(secret, raw) }, body: raw }).then(async r => ({ status: r.status, json: (await r.json()) as any }))
}
const evt = (event: string, orderId: string, amount: number) => ({ event, payload: { payment: { entity: { id: 'pay_wh_1', order_id: orderId, amount, currency: 'INR' } } } })

test('webhook: bad signature rejected; captured credits once; wrong amount rejected; failed does not credit', async () => {
  const p = createPayment(ids.u1, 'razorpay', 'order_wh_1', 30000, null, 0)
  const before = await bal(tok.u1)
  assert.equal((await webhook(evt('payment.captured', 'order_wh_1', 30000), 'wrong-secret')).status, 400)
  assert.equal((await fetch(base + '/payments/webhook/razorpay', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 400) // no signature header
  assert.equal((await webhook(evt('payment.captured', 'order_wh_1', 1))).status, 400) // tampered amount
  assert.equal(await bal(tok.u1), before)
  assert.equal((await webhook(evt('payment.captured', 'order_wh_1', 30000))).status, 200)
  assert.equal((await webhook(evt('payment.captured', 'order_wh_1', 30000))).status, 200) // Razorpay retries
  assert.equal(await bal(tok.u1), before + 30000)
  assert.equal(p.status, 'paid')
  assert.equal((await webhook(evt('payment.captured', 'order_unknown', 100))).json.data.ignored, true)
  const q = createPayment(ids.u1, 'razorpay', 'order_wh_2', 10000, null, 0)
  await webhook(evt('payment.failed', 'order_wh_2', 10000))
  assert.equal(q.status, 'failed'); assert.equal(await bal(tok.u1), before + 30000)
})

test('coupons: admin only, bonus maths, limits, one use per user', async () => {
  const c = { code: 'welcome50', type: 'percent', value: 50, minAmountPaise: 20000, maxBonusPaise: 10000, validFrom: '2020-01-01T00:00:00.000Z', validTo: '2099-01-01T00:00:00.000Z', usageLimit: 2 }
  assert.equal((await call('/admin/coupons', { method: 'POST', token: tok.u1, body: c })).status, 403)
  assert.equal((await call('/admin/coupons', { method: 'POST', token: tok.admin, body: { ...c, maxBonusPaise: 0 } })).status, 400)
  assert.equal((await call('/admin/coupons', { method: 'POST', token: tok.admin, body: c })).status, 201)
  assert.equal((await call('/admin/coupons', { method: 'POST', token: tok.admin, body: c })).status, 409)
  assert.equal(couponBonus({ ...c, code: 'X', usedCount: 0, active: true } as any, 100000), 10000) // 50% of 1000 = 500 capped at 100
  const apply = (t: string, amountPaise: number, code = 'WELCOME50') => call('/coupons/apply', { method: 'POST', token: t, body: { code, amountPaise } })
  assert.equal((await apply(tok.u2, 10000)).status, 400) // below minimum
  assert.equal((await apply(tok.u2, 30000, 'nope')).status, 400)
  const ok1 = await apply(tok.u2, 30000)
  assert.deepEqual(ok1.json.data, { code: 'WELCOME50', bonusPaise: 10000 }) // 50% of 300 = 150, capped at 100

  const before = await bal(tok.u2)
  const r = await call('/wallet/recharge', { method: 'POST', token: tok.u2, body: { amountPaise: 30000, couponCode: ' welcome50 ' } })
  assert.equal(r.json.data.bonusPaise, 10000)
  assert.equal(await bal(tok.u2), before) // nothing until paid
  assert.equal(getDb().coupons[0].usedCount, 0)
  await call('/wallet/recharge/mock-pay', { method: 'POST', token: tok.u2, body: { paymentId: r.json.data.paymentId } })
  assert.equal(await bal(tok.u2), before + 40000)
  assert.equal(getDb().coupons[0].usedCount, 1)
  const types = getDb().walletTxs.filter(t => t.referenceId === r.json.data.paymentId).map(t => t.type).sort()
  assert.deepEqual(types, ['bonus', 'recharge'])
  assert.equal((await apply(tok.u2, 30000)).status, 400) // already used by this user

  assert.equal((await call('/admin/coupons/WELCOME50/active', { method: 'POST', token: tok.admin, body: { active: false } })).status, 200)
  assert.equal((await apply(tok.u1, 30000)).status, 400) // disabled
  assert.ok(getDb().auditLogs.some(a => a.action === 'coupon.create'))
})

test('admin adjustments: needs a reason, cannot overdraw, is audited', async () => {
  const adj = (userId: string, body: unknown, t = tok.admin) => call(`/admin/wallet/${userId}/adjust`, { method: 'POST', token: t, body })
  assert.equal((await adj(ids.u1, { amountPaise: 5000, note: 'x' })).status, 400)
  assert.equal((await adj(ids.u1, { amountPaise: 5000, note: 'Goodwill credit' }, tok.u1)).status, 403)
  const b0 = await bal(tok.u1)
  assert.equal((await adj(ids.u1, { amountPaise: 5000, type: 'refund', note: 'Refund for dropped session' })).json.data.balancePaise, b0 + 5000)
  assert.equal((await adj(ids.u1, { amountPaise: -999_999_9, note: 'Too much to take' })).status, 400)
  assert.equal((await adj(ids.u1, { amountPaise: -(b0 + 6000), note: 'More than the balance' })).status, 402)
  assert.equal((await adj(ids.u1, { amountPaise: -5000, note: 'Reverse the refund' })).json.data.balancePaise, b0)
  assert.equal((await adj(ids.u1, { amountPaise: -5000, type: 'refund', note: 'A refund cannot be negative' })).status, 400)
  assert.equal(getDb().auditLogs.filter(a => a.action === 'wallet.adjust').length, 2)
})

test('account deletion is blocked while the wallet has money', () => {
  assert.ok(getWallet(ids.u1).balancePaise > 0)
  assert.throws(() => deleteAccount(ids.u1), /wallet still has money/)
  assert.equal(getDb().users.find(u => u.id === ids.u1)!.deletedAt, null)
  const fresh = newId(); getDb().users.push({ id: fresh, phone: '+919000000099', email: null, name: '', gender: null, photoUrl: null, language: 'en', theme: 'auto', role: 'user', freeChatUsed: false, createdAt: '', updatedAt: '', deletedAt: null })
  deleteAccount(fresh)
  assert.ok(getDb().users.find(u => u.id === fresh)!.deletedAt)
})

test('settlePayment is idempotent', () => {
  const p = createPayment(ids.admin, 'mock', 'mock_order_z', 10000, null, 0)
  assert.equal(settlePayment(p, 'a').credited, true); assert.equal(settlePayment(p, 'b').credited, false)
  assert.equal(p.providerPaymentId, 'a')
})
