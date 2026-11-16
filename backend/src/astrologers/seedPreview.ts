import { getDb, newId, save } from '../store.js'
import { slugify } from './data.js'
import { PREVIEW } from './previewData.js'

/** Adds the extra sample profiles (and a few sample ratings) that are not there yet. Safe to run repeatedly. */
export function seedPreviewAstrologers(): number {
  const db = getDb(), now = new Date().toISOString()
  let added = 0
  for (const { ratings, ...d } of PREVIEW) {
    const slug = slugify(d.displayName)
    if (db.astrologers.some(a => a.slug === slug)) continue
    const id = newId()
    db.astrologers.push({ ...d, id, userId: null, slug, status: 'approved', isDemo: true, createdAt: now, updatedAt: now })
    for (const rating of ratings) db.reviews.push({ id: newId(), astrologerId: id, userId: 'demo-reviewer', rating, comment: 'Sample review for the preview.', astrologerReply: null, isVisible: true, createdAt: now })
    added++
  }
  if (added) save()
  return added
}
