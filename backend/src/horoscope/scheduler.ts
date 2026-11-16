import { getDb, save } from '../store.js'

/** Publishes entries explicitly marked scheduled once their start date arrives in India. */
export function publishDueHoroscopes(now = new Date()): number {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now)
  let changed = 0
  for (const h of getDb().horoscopes) {
    if (h.status === 'scheduled' && h.dateFrom <= today) {
      h.status = 'published'
      h.updatedAt = now.toISOString()
      changed++
    }
  }
  if (changed) save()
  return changed
}
