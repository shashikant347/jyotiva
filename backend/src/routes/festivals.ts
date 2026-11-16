import { Router } from 'express'
import { z } from 'zod'
import { HttpError } from '../errors.js'
import { ok } from '../http.js'
import { getDb } from '../store.js'

export const festivalsRouter = Router()
const language = z.enum(['en', 'hi']).default('en')
const published = (lang: 'en' | 'hi') => getDb().festivals.filter(f => f.status === 'published' && (f.language === lang || f.language === 'en'))

festivalsRouter.get('/', (req, res) => {
  const { year, lang } = z.object({ year: z.coerce.number().int().min(2000).max(2100).default(new Date().getFullYear()), lang: language }).parse(req.query)
  const items = published(lang).filter(f => f.date.startsWith(String(year))).sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title))
  res.set('Cache-Control', 'public, max-age=300')
  ok(res, { year, items })
})

festivalsRouter.get('/:slug', (req, res) => {
  const lang = language.parse(req.query.lang)
  const item = published(lang).find(f => f.slug === req.params.slug)
  if (!item) throw new HttpError(404, 'NOT_FOUND', 'Festival not found')
  res.set('Cache-Control', 'public, max-age=300')
  ok(res, item)
})
