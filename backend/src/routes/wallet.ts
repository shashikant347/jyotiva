import express, { Router } from 'express'
import { z } from 'zod'
import { config } from '../config.js'
import { HttpError } from '../errors.js'
import { asyncHandler, ok } from '../http.js'
import { currentUser, requireAuth } from '../middleware/auth.js'
import { rechargeLimiter } from '../middleware/rateLimit.js'
import { getDb } from '../store.js'
import { createOrder, verifyCheckoutSignature, verifyWebhookSignature } from '../wallet/gateway.js'
import { checkCoupon, createPayment, gatewayMode, getWallet, settlePayment } from '../wallet/service.js'

export const walletRouter = Router()
export const paymentsRouter = Router()
export const couponsRouter = Router()

const amount = z.number().int().min(config.minRechargePaise).max(config.maxRechargePaise)
const view = (t: { id: string; type: string; amountPaise: number; balanceAfterPaise: number; note: string; createdAt: string }) =>
  ({ id: t.id, type: t.type, amountPaise: t.amountPaise, balanceAfterPaise: t.balanceAfterPaise, note: t.note, createdAt: t.createdAt })

walletRouter.use(requireAuth)

walletRouter.get('/', (_req, res) => {
  const mode = gatewayMode()
  ok(res, {
    balancePaise: getWallet(currentUser(res).id).balancePaise,
    gateway: { mode, keyId: mode === 'razorpay' ? config.razorpayKeyId : null },
    limits: { minPaise: config.minRechargePaise, maxPaise: config.maxRechargePaise },
    presetsPaise: [10000, 20000, 50000, 100000],
  })
})

walletRouter.get('/transactions', (req, res) => {
  const page = z.coerce.number().int().min(1).max(1000).default(1).parse(req.query.page)
  const all = getDb().walletTxs.filter(t => t.userId === currentUser(res).id).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || 0)
  ok(res, { total: all.length, page, items: all.slice((page - 1) * 20, page * 20).map(view) })
})

walletRouter.post('/recharge', rechargeLimiter, asyncHandler(async (req, res) => {
  const user = currentUser(res)
  const b = z.object({ amountPaise: amount, couponCode: z.string().trim().max(30).optional() }).strict().parse(req.body)
  let code: string | null = null, bonus = 0
  if (b.couponCode) { const c = checkCoupon(user.id, b.couponCode, b.amountPaise); code = c.coupon.code; bonus = c.bonusPaise }
  const order = await createOrder(b.amountPaise, `w_${user.id.slice(0, 8)}`)
  const p = createPayment(user.id, order.provider, order.orderId, b.amountPaise, code, bonus)
  ok(res, { paymentId: p.id, orderId: p.providerOrderId, amountPaise: p.amountPaise, bonusPaise: p.bonusPaise, provider: p.provider, keyId: order.provider === 'razorpay' ? config.razorpayKeyId : null }, 201)
}))

const own = (userId: string, paymentId: string) => {
  const p = getDb().payments.find(x => x.id === paymentId && x.userId === userId)
  if (!p) throw new HttpError(404, 'NOT_FOUND', 'Payment not found')
  return p
}

// Called by the browser after Razorpay Checkout succeeds. The signature proves the order/payment pair is genuine.
walletRouter.post('/recharge/confirm', asyncHandler(async (req, res) => {
  const b = z.object({ paymentId: z.string().max(64), razorpayOrderId: z.string().max(64), razorpayPaymentId: z.string().max(64), razorpaySignature: z.string().max(200) }).strict().parse(req.body)
  const p = own(currentUser(res).id, b.paymentId)
  if (p.provider !== 'razorpay' || p.providerOrderId !== b.razorpayOrderId) throw new HttpError(400, 'PAYMENT_MISMATCH', 'This payment does not match the order')
  if (!verifyCheckoutSignature(b.razorpayOrderId, b.razorpayPaymentId, b.razorpaySignature)) throw new HttpError(400, 'BAD_SIGNATURE', 'Payment could not be verified')
  settlePayment(p, b.razorpayPaymentId)
  ok(res, { status: p.status, balancePaise: getWallet(p.userId).balancePaise })
}))

// Development only: pretend the payment succeeded. Unavailable once real keys are set or in production.
walletRouter.post('/recharge/mock-pay', asyncHandler(async (req, res) => {
  if (gatewayMode() !== 'mock') throw new HttpError(404, 'NOT_FOUND', 'Not found')
  const b = z.object({ paymentId: z.string().max(64) }).strict().parse(req.body)
  const p = own(currentUser(res).id, b.paymentId)
  if (p.provider !== 'mock') throw new HttpError(400, 'PAYMENT_MISMATCH', 'Not a mock payment')
  settlePayment(p, `mock_pay_${p.id}`)
  ok(res, { status: p.status, balancePaise: getWallet(p.userId).balancePaise })
}))

walletRouter.get('/payments/:id', (req, res) => {
  const p = own(currentUser(res).id, req.params.id)
  ok(res, { id: p.id, status: p.status, amountPaise: p.amountPaise, bonusPaise: p.bonusPaise, couponCode: p.couponCode, createdAt: p.createdAt, paidAt: p.paidAt })
})

couponsRouter.post('/apply', requireAuth, (req, res) => {
  const b = z.object({ code: z.string().trim().min(1).max(30), amountPaise: amount }).strict().parse(req.body)
  const { coupon, bonusPaise } = checkCoupon(currentUser(res).id, b.code, b.amountPaise)
  ok(res, { code: coupon.code, bonusPaise })
})

// Razorpay webhook: the source of truth when the browser closes before confirming. Needs the RAW body to verify the signature.
paymentsRouter.post('/webhook/razorpay', express.raw({ type: '*/*', limit: '100kb' }), (req, res) => {
  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0)
  if (!verifyWebhookSignature(raw, req.get('x-razorpay-signature') ?? '')) { res.status(400).json({ success: false, error: { code: 'BAD_SIGNATURE', message: 'Invalid signature' } }); return }
  let evt: { event?: string; payload?: { payment?: { entity?: { id?: string; order_id?: string; amount?: number; currency?: string } } } }
  try { evt = JSON.parse(raw.toString('utf8')) } catch { res.status(400).json({ success: false, error: { code: 'BAD_JSON', message: 'Invalid body' } }); return }
  const e = evt.payload?.payment?.entity
  const p = e?.order_id ? getDb().payments.find(x => x.providerOrderId === e.order_id) : undefined
  if (!p || !e?.id) { res.json({ success: true, data: { ignored: true } }); return } // unknown order: acknowledge so Razorpay stops retrying
  if (evt.event === 'payment.captured' || evt.event === 'order.paid') {
    // Never credit an amount other than the one we created the order for.
    if (e.amount !== p.amountPaise || (e.currency && e.currency !== 'INR')) { res.status(400).json({ success: false, error: { code: 'AMOUNT_MISMATCH', message: 'Amount does not match the order' } }); return }
    settlePayment(p, e.id)
  } else if (evt.event === 'payment.failed' && p.status === 'created') {
    p.status = 'failed'
  }
  res.json({ success: true, data: { received: true } })
})
