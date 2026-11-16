import crypto from 'node:crypto'
import { config } from '../config.js'
import { HttpError } from '../errors.js'
import { newId } from '../store.js'
import { gatewayMode } from './service.js'

const hmac = (secret: string, data: string | Buffer): string => crypto.createHmac('sha256', secret).update(data).digest('hex')
const safeEq = (a: string, b: string): boolean => {
  const x = Buffer.from(a), y = Buffer.from(b)
  return x.length === y.length && crypto.timingSafeEqual(x, y)
}

/** Razorpay Checkout callback signature: HMAC-SHA256 of "order_id|payment_id" with the key secret. */
export const verifyCheckoutSignature = (orderId: string, paymentId: string, signature: string, secret = config.razorpayKeySecret): boolean =>
  !!secret && !!signature && safeEq(hmac(secret, `${orderId}|${paymentId}`), signature)

/** Razorpay webhook signature: HMAC-SHA256 of the raw request body with the webhook secret. */
export const verifyWebhookSignature = (rawBody: Buffer, signature: string, secret = config.razorpayWebhookSecret): boolean =>
  !!secret && !!signature && safeEq(hmac(secret, rawBody), signature)

export interface GatewayOrder { provider: 'razorpay' | 'mock'; orderId: string }

export async function createOrder(amountPaise: number, receipt: string): Promise<GatewayOrder> {
  const mode = gatewayMode()
  if (mode === 'unavailable') throw new HttpError(503, 'PAYMENTS_UNAVAILABLE', 'Payments are not available right now')
  if (mode === 'mock') return { provider: 'mock', orderId: `mock_order_${newId()}` }
  const auth = Buffer.from(`${config.razorpayKeyId}:${config.razorpayKeySecret}`).toString('base64')
  let r: Response
  try {
    r = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST', headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: amountPaise, currency: 'INR', receipt: receipt.slice(0, 40) }), signal: AbortSignal.timeout(10_000),
    })
  } catch { throw new HttpError(502, 'GATEWAY_ERROR', 'Could not reach the payment provider. Please try again.') }
  if (!r.ok) throw new HttpError(502, 'GATEWAY_ERROR', 'The payment provider rejected the request. Please try again.')
  const j = (await r.json()) as { id?: string }
  if (!j.id) throw new HttpError(502, 'GATEWAY_ERROR', 'Unexpected response from the payment provider')
  return { provider: 'razorpay', orderId: j.id }
}
