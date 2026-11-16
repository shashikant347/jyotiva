import * as webPush from 'web-push'
import { config } from '../config.js'
import { getDb, save, type WebPushSubscription } from '../store.js'

export interface PushPayload { title: string; body: string; href: string }

export function isWebPushConfigured(): boolean {
  return !!(config.vapidPublicKey && config.vapidPrivateKey && config.vapidSubject)
}

export function initWebPush(): boolean {
  if (!isWebPushConfigured()) return false
  webPush.setVapidDetails(config.vapidSubject, config.vapidPublicKey, config.vapidPrivateKey)
  return true
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!isWebPushConfigured()) return
  const subscriptions = getDb().webPushSubscriptions.filter(s => s.userId === userId)
  if (!subscriptions.length) return
  const message = JSON.stringify({ title: payload.title, body: payload.body, href: payload.href })
  const results = await Promise.allSettled(subscriptions.map(s =>
    webPush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, message, { TTL: 60, urgency: 'high' }),
  ))
  let removed = false
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') return
    const error = result.reason as webPush.WebPushError
    if (error.statusCode === 404 || error.statusCode === 410) {
      const stale: WebPushSubscription = subscriptions[index]
      getDb().webPushSubscriptions = getDb().webPushSubscriptions.filter(s => s.id !== stale.id)
      removed = true
    } else console.warn('Web push delivery failed:', error.statusCode ?? 'network error')
  })
  if (removed) save()
}
