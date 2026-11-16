import { config } from '../config.js'
import { HttpError } from '../errors.js'
import { getDb, newId, save, type Coupon, type Payment, type Wallet, type WalletTx } from '../store.js'

// All wallet changes go through these functions. Node runs them to completion without interleaving, so each is atomic
// with the JSON store. When this moves to PostgreSQL, wrap each in a transaction with SELECT ... FOR UPDATE on the wallet row.

export const getWallet = (userId: string): Wallet => {
  const db = getDb()
  let w = db.wallets.find(x => x.userId === userId)
  if (!w) { w = { userId, balancePaise: 0, updatedAt: new Date().toISOString() }; db.wallets.push(w) }
  return w
}

function post(userId: string, type: WalletTx['type'], amountPaise: number, referenceType: WalletTx['referenceType'], referenceId: string, note: string): WalletTx {
  if (!Number.isInteger(amountPaise) || amountPaise === 0) throw new Error('Amount must be a non-zero integer number of paise')
  const db = getDb(), w = getWallet(userId)
  // Idempotency: the same business event (e.g. a payment) can only be posted once per type.
  const dup = db.walletTxs.find(t => t.userId === userId && t.type === type && t.referenceType === referenceType && t.referenceId === referenceId)
  if (dup) return dup
  if (w.balancePaise + amountPaise < 0) throw new HttpError(402, 'INSUFFICIENT_BALANCE', 'Not enough balance in the wallet')
  const now = new Date().toISOString()
  w.balancePaise += amountPaise; w.updatedAt = now
  const tx: WalletTx = { id: newId(), userId, type, amountPaise, balanceAfterPaise: w.balancePaise, referenceType, referenceId, note, createdAt: now }
  db.walletTxs.push(tx)
  save()
  return tx
}

export const creditWallet = (userId: string, type: 'recharge' | 'bonus' | 'refund' | 'adjustment', amountPaise: number, referenceType: WalletTx['referenceType'], referenceId: string, note: string) => {
  if (amountPaise <= 0) throw new Error('A credit must be positive')
  return post(userId, type, amountPaise, referenceType, referenceId, note)
}
/** Used by sessions in a later phase. Throws INSUFFICIENT_BALANCE rather than going negative. */
export const debitWallet = (userId: string, amountPaise: number, referenceType: WalletTx['referenceType'], referenceId: string, note: string, type: 'debit' | 'adjustment' = 'debit') => {
  if (amountPaise <= 0) throw new Error('A debit must be positive')
  return post(userId, type, -amountPaise, referenceType, referenceId, note)
}

// ---- coupons ----
export const normalizeCode = (c: string): string => c.trim().toUpperCase()

export function couponBonus(c: Coupon, amountPaise: number): number {
  const raw = c.type === 'flat' ? c.value : Math.floor((amountPaise * c.value) / 100)
  return c.type === 'percent' ? Math.min(raw, c.maxBonusPaise) : raw
}

/** Validates a coupon for this user and amount. Returns the coupon and the bonus it would give. */
export function checkCoupon(userId: string, code: string, amountPaise: number, now = new Date()): { coupon: Coupon; bonusPaise: number } {
  const c = getDb().coupons.find(x => x.code === normalizeCode(code))
  const bad = (m: string) => new HttpError(400, 'COUPON_INVALID', m)
  if (!c || !c.active) throw bad('This coupon code is not valid')
  const t = now.toISOString()
  if (t < c.validFrom) throw bad('This coupon is not active yet')
  if (t > c.validTo) throw bad('This coupon has expired')
  if (c.usedCount >= c.usageLimit) throw bad('This coupon has been fully used')
  if (amountPaise < c.minAmountPaise) throw bad(`Recharge at least ₹${c.minAmountPaise / 100} to use this coupon`)
  if (getDb().payments.some(p => p.userId === userId && p.status === 'paid' && p.couponCode === c.code)) throw bad('You have already used this coupon')
  const bonusPaise = couponBonus(c, amountPaise)
  if (bonusPaise <= 0) throw bad('This coupon gives no bonus for this amount')
  return { coupon: c, bonusPaise }
}

// ---- payments ----
export function createPayment(userId: string, provider: Payment['provider'], providerOrderId: string, amountPaise: number, couponCode: string | null, bonusPaise: number): Payment {
  const p: Payment = { id: newId(), userId, provider, providerOrderId, providerPaymentId: null, amountPaise, couponCode, bonusPaise, status: 'created', createdAt: new Date().toISOString(), paidAt: null }
  getDb().payments.push(p)
  save()
  return p
}

/** Marks a payment paid and credits the wallet (and coupon bonus). Safe to call many times: confirm, webhook and retries all land here. */
export function settlePayment(p: Payment, providerPaymentId: string): { credited: boolean } {
  if (p.status === 'paid') return { credited: false }
  p.status = 'paid'; p.providerPaymentId = providerPaymentId; p.paidAt = new Date().toISOString()
  creditWallet(p.userId, 'recharge', p.amountPaise, 'payment', p.id, 'Wallet recharge')
  if (p.couponCode && p.bonusPaise > 0) {
    const c = getDb().coupons.find(x => x.code === p.couponCode)
    if (c) c.usedCount += 1
    creditWallet(p.userId, 'bonus', p.bonusPaise, 'payment', p.id, `Coupon ${p.couponCode}`)
  }
  save()
  return { credited: true }
}

export const audit = (actorId: string, action: string, entity: string, entityId: string, meta: unknown): void => {
  getDb().auditLogs.push({ id: newId(), actorId, action, entity, entityId, meta, createdAt: new Date().toISOString() })
  save()
}

export const gatewayMode = (): 'razorpay' | 'mock' | 'unavailable' =>
  config.razorpayKeyId && config.razorpayKeySecret ? 'razorpay' : config.isProd ? 'unavailable' : 'mock'
