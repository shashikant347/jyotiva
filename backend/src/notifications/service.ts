import { EventEmitter } from 'node:events'
import { HttpError } from '../errors.js'
import { getDb, newId, save, type Astrologer, type AvailabilityWatch, type Notification } from '../store.js'
import { isAstrologerLive } from '../astrologers/presence.js'

export const notificationBus = new EventEmitter()

export function notifyUser(userId: string, type: Notification['type'], title: string, body: string, href: string): Notification | null {
  const db = getDb()
  if (!db.users.some(u => u.id === userId && !u.deletedAt && u.status !== 'suspended')) return null
  const notification: Notification = { id: newId(), userId, type, title, body, href, readAt: null, createdAt: new Date().toISOString() }
  db.notifications.push(notification)
  save()
  notificationBus.emit('new', notification)
  return notification
}

export function isAstrologerAvailable(a: Astrologer): boolean {
  const db = getDb()
  return a.status === 'approved' && isAstrologerLive(a) && !a.isBusy && !db.sessions.some(s => s.astrologerId === a.id && (s.status === 'requested' || s.status === 'active'))
}

export function getAvailabilityWatch(userId: string, astrologerId: string): AvailabilityWatch | undefined {
  return getDb().availabilityWatches.find(w => w.userId === userId && w.astrologerId === astrologerId && w.active)
}

export function createAvailabilityWatch(userId: string, astrologerId: string): AvailabilityWatch {
  const db = getDb(), existing = getAvailabilityWatch(userId, astrologerId)
  if (existing) return existing
  if (db.availabilityWatches.filter(w => w.userId === userId && w.active).length >= 25) throw new HttpError(409, 'LIMIT_REACHED', 'You can follow up to 25 astrologers at a time')
  const watch: AvailabilityWatch = { id: newId(), userId, astrologerId, active: true, createdAt: new Date().toISOString() }
  db.availabilityWatches.push(watch); save()
  return watch
}

export function removeAvailabilityWatch(userId: string, astrologerId: string): boolean {
  const watch = getAvailabilityWatch(userId, astrologerId)
  if (!watch) return false
  watch.active = false; save()
  return true
}

/** Persist one in-app alert per active watch when an approved astrologer is ready for chat. */
export function notifyAvailability(a: Astrologer): number {
  if (!isAstrologerAvailable(a)) return 0
  const db = getDb()
  let count = 0
  const watches = db.availabilityWatches.filter(w => w.astrologerId === a.id && w.active)
  for (const watch of watches) {
    watch.active = false
    if (notifyUser(watch.userId, 'astrologer_available', 'Astrologer is available', `${a.displayName} is available for a chat now.`, `/best-astrologer/${a.slug}`)) count++
  }
  if (watches.length) save()
  return count
}

export function notificationsFor(userId: string): Notification[] {
  return getDb().notifications.filter(n => n.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100)
}

export function markNotificationRead(userId: string, id: string): Notification | null {
  const item = getDb().notifications.find(n => n.id === id && n.userId === userId)
  if (!item) return null
  if (!item.readAt) { item.readAt = new Date().toISOString(); save() }
  return item
}
