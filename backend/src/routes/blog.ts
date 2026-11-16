import { Router } from 'express'
import fs from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { slugify } from '../astrologers/data.js'
import { config } from '../config.js'
import { HttpError } from '../errors.js'
import { asyncHandler, ok } from '../http.js'
import { getDb, type BlogPost } from '../store.js'

export const blogRouter = Router()
const mediaDir = path.resolve(path.dirname(path.resolve(config.dataFile)), 'media', 'blog')

export const postView = (p: BlogPost, withBody: boolean) => ({
  slug: p.slug, coverImageUrl: p.coverImageUrl ?? null, title: p.title, excerpt: p.excerpt, category: p.category, tags: p.tags, authorName: p.authorName, language: p.language,
  seoTitle: p.seoTitle, seoDescription: p.seoDescription, isSample: p.isSample, publishedAt: p.publishedAt, ...(withBody ? { body: p.body } : {}),
})
const published = (): BlogPost[] => getDb().blogPosts.filter(p => p.status === 'published' && p.publishedAt)
const byDate = (a: BlogPost, b: BlogPost) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '')

blogRouter.get('/media/:filename', asyncHandler(async (req, res) => {
  const filename = req.params.filename
  if (!/^[a-f0-9-]{36}\.(jpg|png|webp)$/.test(filename)) throw new HttpError(404, 'NOT_FOUND', 'Cover image not found')
  const type = filename.endsWith('.jpg') ? 'image/jpeg' : filename.endsWith('.png') ? 'image/png' : 'image/webp'
  try {
    const image = await fs.readFile(path.join(mediaDir, filename))
    res.set({ 'Content-Type': type, 'Content-Length': String(image.length), 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' })
    res.send(image)
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') throw new HttpError(404, 'NOT_FOUND', 'Cover image not found')
    throw e
  }
}))

const listQuery = z.object({
  category: z.string().max(40).optional(), q: z.string().trim().max(60).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1), limit: z.coerce.number().int().min(1).max(30).default(9),
})

blogRouter.get('/', (req, res) => {
  const q = listQuery.parse(req.query), needle = q.q?.toLowerCase()
  const all = published()
  const categories = [...new Set(all.map(p => p.category))].sort()
  const list = all.filter(p => (!q.category || p.category === q.category) && (!needle || p.title.toLowerCase().includes(needle) || p.excerpt.toLowerCase().includes(needle) || p.tags.some(t => t.toLowerCase() === needle))).sort(byDate)
  res.set('Cache-Control', 'public, max-age=60')
  ok(res, { total: list.length, page: q.page, limit: q.limit, categories, items: list.slice((q.page - 1) * q.limit, q.page * q.limit).map(p => postView(p, false)) })
})

blogRouter.get('/:slug', (req, res) => {
  const p = published().find(x => x.slug === req.params.slug)
  if (!p) throw new HttpError(404, 'NOT_FOUND', 'Article not found')
  const related = published().filter(x => x.slug !== p.slug && (x.category === p.category || x.tags.some(t => p.tags.includes(t)))).sort(byDate).slice(0, 3).map(x => postView(x, false))
  res.set('Cache-Control', 'public, max-age=60')
  ok(res, { post: postView(p, true), related })
})

// ---- admin (mounted from routes/admin.ts, which already requires an admin) ----
export const postBody = z.object({
  title: z.string().trim().min(3).max(140), slug: z.string().trim().max(80).optional(),
  excerpt: z.string().trim().min(10).max(300), body: z.string().trim().min(50, 'The article is too short').max(60_000),
  category: z.string().trim().min(2).max(40), tags: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
  authorName: z.string().trim().min(2).max(60), language: z.enum(['en', 'hi']).default('en'),
  seoTitle: z.string().trim().max(70).default(''), seoDescription: z.string().trim().max(170).default(''),
  status: z.enum(['draft', 'published']).default('draft'),
}).strict()

export function uniqueSlug(base: string, exceptId?: string): string {
  const root = slugify(base).replace(/^astrologer$/, 'article'), used = new Set(getDb().blogPosts.filter(p => p.id !== exceptId).map(p => p.slug))
  let s = root, n = 2
  while (used.has(s)) s = `${root.slice(0, 70)}-${n++}`
  return s
}
