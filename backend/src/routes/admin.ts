import express, { Router } from 'express'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { config } from '../config.js'
import { HttpError } from '../errors.js'
import { asyncHandler, ok } from '../http.js'
import { requireAdmin, requireAdminRole, requireAuth, currentUser } from '../middleware/auth.js'
import { parseHoroscopeCsv, TEMPLATE_CSV } from '../horoscope/import.js'
import { publicAstrologer } from './astrologers.js'
import { getDb, newId, save, type Festival, type Horoscope } from '../store.js'
import { audit, creditWallet, debitWallet, getWallet, normalizeCode } from '../wallet/service.js'
import { hasOpenSession, refundSession, sessionView } from '../sessions/service.js'
import { messageView, ticketView } from './support.js'
import { postBody, postView, uniqueSlug } from './blog.js'
import { notifyUser } from '../notifications/service.js'

export const adminRouter = Router()
adminRouter.use(requireAuth, requireAdmin, express.json({ limit: '1mb' })) // admin bodies may carry a CSV, so the limit is higher than the public 50kb

adminRouter.get('/dashboard', requireAdminRole('super_admin'), (_req, res) => {
  const db = getDb()
  const now = new Date()
  const today = new Date(now)
  today.setUTCHours(0, 0, 0, 0)
  const todayStart = today.getTime()
  const todayIso = today.toISOString()
  const paidToday = db.payments.filter(p => p.status === 'paid' && p.paidAt && p.paidAt >= todayIso)
  const endedToday = db.sessions.filter(s => s.status === 'ended' && s.endedAt !== null && s.endedAt >= todayStart)

  ok(res, {
    metrics: {
      users: {
        total: db.users.filter(u => !u.deletedAt).length,
        newToday: db.users.filter(u => !u.deletedAt && u.createdAt >= todayIso).length,
      },
      astrologers: {
        approved: db.astrologers.filter(a => !a.isDemo && a.status === 'approved').length,
        pending: db.astrologers.filter(a => !a.isDemo && a.status === 'pending').length,
        online: db.astrologers.filter(a => !a.isDemo && a.status === 'approved' && a.isOnline).length,
        demo: db.astrologers.filter(a => a.isDemo).length,
      },
      sessions: {
        total: db.sessions.length,
        active: db.sessions.filter(s => s.status === 'active').length,
        endedToday: endedToday.length,
        platformFeesPaise: db.sessions.filter(s => s.status === 'ended').reduce((total, s) => total + s.platformFeePaise, 0),
      },
      payouts: {
        requested: db.astrologerPayouts.filter(p => p.status === 'requested').length,
        approved: db.astrologerPayouts.filter(p => p.status === 'approved').length,
      },
      payments: {
        paidTodayCount: paidToday.length,
        paidTodayPaise: paidToday.reduce((total, p) => total + p.amountPaise, 0),
        totalPaidPaise: db.payments.filter(p => p.status === 'paid').reduce((total, p) => total + p.amountPaise, 0),
      },
      openSupportTickets: db.supportTickets.filter(t => t.status === 'open').length,
      publishedHoroscopes: db.horoscopes.filter(h => h.status === 'published').length,
      publishedBlogPosts: db.blogPosts.filter(p => p.status === 'published').length,
    },
    recentSessions: db.sessions.slice().sort((a, b) => b.requestedAt - a.requestedAt).slice(0, 5).map(s => ({
      id: s.id,
      status: s.status,
      requestedAt: s.requestedAt,
      durationSeconds: s.durationSeconds,
      amountChargedPaise: s.amountChargedPaise,
      isFree: s.isFree,
    })),
  })
})

adminRouter.get('/users', requireAdminRole('super_admin'), (req, res) => {
  const query = z.object({
    q: z.string().trim().max(100).optional(),
    role: z.enum(['user', 'astrologer', 'admin']).optional(),
    status: z.enum(['active', 'suspended']).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    includeDeleted: z.enum(['true', 'false']).default('false'),
  }).strict().parse(req.query)
  const db = getDb()
  const needle = query.q?.toLowerCase()
  const users = db.users
    .filter(u => (query.includeDeleted === 'true' || !u.deletedAt) && (!query.role || u.role === query.role))
    .filter(u => !query.status || (!u.deletedAt && (u.status ?? 'active') === query.status))
    .filter(u => !needle || u.name.toLowerCase().includes(needle) || u.phone.toLowerCase().includes(needle))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const total = users.length
  const items = users.slice((query.page - 1) * query.limit, query.page * query.limit).map(u => ({
    id: u.id,
    name: u.name,
    phone: u.phone,
    role: u.role,
    adminRole: u.role === 'admin' ? (u.adminRole ?? 'super_admin') : null,
    status: u.deletedAt ? 'deleted' : (u.status ?? 'active'),
    createdAt: u.createdAt,
    deletedAt: u.deletedAt,
    walletBalancePaise: db.wallets.find(w => w.userId === u.id)?.balancePaise ?? 0,
    sessionCount: db.sessions.filter(s => s.userId === u.id).length,
  }))
  ok(res, { items, page: query.page, limit: query.limit, total, pages: Math.max(1, Math.ceil(total / query.limit)) })
})

adminRouter.post('/users/:id/admin-role', requireAdminRole('super_admin'), asyncHandler(async (req, res) => {
  const { adminRole } = z.object({ adminRole: z.enum(['super_admin', 'support', 'content', 'finance']) }).strict().parse(req.body)
  const db = getDb()
  const target = db.users.find(u => u.id === req.params.id && !u.deletedAt)
  if (!target || target.role !== 'admin') throw new HttpError(404, 'NOT_FOUND', 'Active admin account not found')
  const actor = currentUser(res)
  const previous = target.adminRole ?? 'super_admin'
  if (target.id === actor.id && adminRole !== previous) throw new HttpError(409, 'SELF_ROLE_CHANGE', 'You cannot change your own admin role')
  const superAdminCount = db.users.filter(u => u.role === 'admin' && !u.deletedAt && (u.adminRole ?? 'super_admin') === 'super_admin').length
  if (previous === 'super_admin' && adminRole !== 'super_admin' && superAdminCount <= 1) {
    throw new HttpError(409, 'LAST_SUPER_ADMIN', 'At least one active super admin must remain')
  }
  if (adminRole !== previous) {
    target.adminRole = adminRole
    target.updatedAt = new Date().toISOString()
    audit(actor.id, 'admin.role_change', 'user', target.id, { previous, adminRole })
    save()
  }
  ok(res, { id: target.id, role: target.role, adminRole })
}))

adminRouter.post('/users/:id/status', requireAdminRole('super_admin'), asyncHandler(async (req, res) => {
  const { status } = z.object({ status: z.enum(['active', 'suspended']) }).strict().parse(req.body)
  const db = getDb()
  const target = db.users.find(u => u.id === req.params.id && !u.deletedAt)
  if (!target || target.role === 'admin') throw new HttpError(404, 'NOT_FOUND', 'Active non-admin account not found')
  if ((target.status ?? 'active') === status) { ok(res, { id: target.id, status }); return }
  if (status === 'suspended' && hasOpenSession(target.id)) throw new HttpError(409, 'SESSION_OPEN', 'Finish or reject the active chat before suspending this account')
  const now = new Date().toISOString()
  target.status = status
  target.updatedAt = now
  if (status === 'suspended') {
    for (const token of db.refreshTokens) if (token.userId === target.id && !token.revokedAt) token.revokedAt = Date.now()
    const astrologer = db.astrologers.find(a => a.userId === target.id)
    if (astrologer) {
      astrologer.isOnline = false
      astrologer.isBusy = false
      astrologer.updatedAt = now
    }
  }
  const actor = currentUser(res)
  audit(actor.id, 'user.status_change', 'user', target.id, { status })
  save()
  ok(res, { id: target.id, status })
}))

adminRouter.get('/audit-logs', requireAdminRole('super_admin'), (req, res) => {
  const query = z.object({
    q: z.string().trim().max(100).optional(),
    entity: z.string().trim().min(1).max(40).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  }).strict().parse(req.query)
  const db = getDb()
  const needle = query.q?.toLowerCase()
  const usersById = new Map(db.users.map(u => [u.id, u]))
  const logs = db.auditLogs
    .filter(log => !query.entity || log.entity === query.entity)
    .filter(log => {
      if (!needle) return true
      const actor = usersById.get(log.actorId)
      return log.action.toLowerCase().includes(needle)
        || log.entityId.toLowerCase().includes(needle)
        || log.actorId.toLowerCase().includes(needle)
        || (actor?.name.toLowerCase().includes(needle) ?? false)
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const total = logs.length
  const items = logs.slice((query.page - 1) * query.limit, query.page * query.limit).map(log => ({
    id: log.id,
    actorId: log.actorId,
    actorName: usersById.get(log.actorId)?.name || 'Admin account',
    action: log.action,
    entity: log.entity,
    entityId: log.entityId,
    meta: log.meta,
    createdAt: log.createdAt,
  }))
  ok(res, { items, page: query.page, limit: query.limit, total, pages: Math.max(1, Math.ceil(total / query.limit)) })
})

const csvCell = (value: unknown) => {
  let text = value === null || value === undefined ? '' : String(value)
  if (/^[\t\r ]*[=+\-@]/.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

adminRouter.get('/reports/export', requireAdminRole('finance'), (req, res) => {
  const query = z.object({
    type: z.enum(['payments', 'sessions']),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }).strict().superRefine((q, ctx) => {
    const from = Date.parse(`${q.from}T00:00:00.000Z`)
    const to = Date.parse(`${q.to}T00:00:00.000Z`)
    if (!Number.isFinite(from) || new Date(from).toISOString().slice(0, 10) !== q.from) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['from'], message: 'Use a valid calendar date' })
    if (!Number.isFinite(to) || new Date(to).toISOString().slice(0, 10) !== q.to) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['to'], message: 'Use a valid calendar date' })
    if (Number.isFinite(from) && Number.isFinite(to) && to < from) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['to'], message: 'End date must be on or after start date' })
    if (Number.isFinite(from) && Number.isFinite(to) && to - from > 365 * 86400000) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['to'], message: 'Date range cannot exceed 366 days' })
  }).parse(req.query)
  const from = Date.parse(`${query.from}T00:00:00.000Z`)
  const to = Date.parse(`${query.to}T23:59:59.999Z`)
  let rows: unknown[][]
  if (query.type === 'payments') {
    const payments = getDb().payments.filter(p => {
      const created = Date.parse(p.createdAt)
      return created >= from && created <= to
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    if (payments.length > 50000) throw new HttpError(413, 'REPORT_TOO_LARGE', 'Choose a narrower date range to export at most 50,000 payments')
    rows = [
      ['payment_id', 'created_at', 'status', 'provider', 'provider_order_id', 'user_id', 'amount_paise', 'bonus_paise', 'coupon_code', 'paid_at'],
      ...payments.map(p => [p.id, p.createdAt, p.status, p.provider, p.providerOrderId, p.userId, p.amountPaise, p.bonusPaise, p.couponCode, p.paidAt]),
    ]
  } else {
    const sessions = getDb().sessions.filter(s => s.requestedAt >= from && s.requestedAt <= to).sort((a, b) => b.requestedAt - a.requestedAt)
    if (sessions.length > 50000) throw new HttpError(413, 'REPORT_TOO_LARGE', 'Choose a narrower date range to export at most 50,000 sessions')
    rows = [
      ['session_id', 'requested_at', 'status', 'user_id', 'astrologer_id', 'type', 'is_free', 'duration_seconds', 'billed_minutes', 'amount_charged_paise', 'refunded_paise', 'platform_fee_paise', 'astrologer_earning_paise'],
      ...sessions.map(s => [s.id, new Date(s.requestedAt).toISOString(), s.status, s.userId, s.astrologerId, s.type, s.isFree, s.durationSeconds, s.billedMinutes, s.amountChargedPaise, s.refundedPaise, s.platformFeePaise, s.astrologerEarningPaise]),
    ]
  }
  const csv = rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n'
  res.type('text/csv').set('Content-Disposition', `attachment; filename="jyotiva-${query.type}-${query.from}-to-${query.to}.csv"`).send(csv)
})

adminRouter.get('/horoscopes/template', requireAdminRole('content'), (_req, res) => {
  res.type('text/csv').set('Content-Disposition', 'attachment; filename="horoscope-template.csv"').send(TEMPLATE_CSV)
})

const importBody = z.object({ csv: z.string().min(1).max(900_000), publish: z.boolean().default(false), schedule: z.boolean().default(false), dryRun: z.boolean().default(false) }).strict()

adminRouter.post('/horoscopes/import', requireAdminRole('content'), asyncHandler(async (req, res) => {
  const body = importBody.parse(req.body)
  let parsed
  try { parsed = parseHoroscopeCsv(body.csv) } catch (e) { throw new HttpError(400, 'VALIDATION', (e as Error).message) }
  // All-or-nothing: if any row is bad, nothing is written, so a half-imported month never goes live.
  if (parsed.errors.length) { ok(res, { imported: 0, created: 0, updated: 0, errors: parsed.errors, applied: false }); return }
  if (body.dryRun) { ok(res, { imported: parsed.rows.length, created: 0, updated: 0, errors: [], applied: false }); return }

  const db = getDb(), now = new Date().toISOString()
  let created = 0, updated = 0
  for (const r of parsed.rows) {
    const existing = db.horoscopes.find(h => h.sign === r.sign && h.period === r.period && h.category === r.category && h.language === r.language && h.dateFrom === r.dateFrom)
    const status: Horoscope['status'] = body.publish ? 'published' : body.schedule ? 'scheduled' : 'draft'
    if (existing) { Object.assign(existing, r, { status, updatedAt: now }); updated++ }
    else { db.horoscopes.push({ id: newId(), ...r, status, createdAt: now, updatedAt: now }); created++ }
  }
  save()
  ok(res, { imported: parsed.rows.length, created, updated, errors: [], applied: true, status: body.publish ? 'published' : body.schedule ? 'scheduled' : 'draft' })
}))

adminRouter.get('/horoscopes', requireAdminRole('content'), (req, res) => {
  const q = z.object({ period: z.enum(['daily', 'weekly', 'monthly', 'yearly']).optional(), status: z.enum(['draft', 'scheduled', 'published']).optional(), from: z.string().optional() }).parse(req.query)
  const list = getDb().horoscopes
    .filter(h => (!q.period || h.period === q.period) && (!q.status || h.status === q.status) && (!q.from || h.dateFrom >= q.from))
    .sort((a, b) => b.dateFrom.localeCompare(a.dateFrom) || a.sign - b.sign).slice(0, 500)
  ok(res, { total: list.length, items: list })
})

adminRouter.post('/horoscopes/publish', requireAdminRole('content'), asyncHandler(async (req, res) => {
  const b = z.object({ period: z.enum(['daily', 'weekly', 'monthly', 'yearly']), dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), status: z.enum(['draft', 'published']) }).strict().parse(req.body)
  const now = new Date().toISOString()
  let n = 0
  for (const h of getDb().horoscopes) if (h.period === b.period && h.dateFrom === b.dateFrom && h.status !== b.status) { h.status = b.status; h.updatedAt = now; n++ }
  save()
  ok(res, { changed: n })
}))

// ---- editor-managed festival calendar; dates are entered from the editor's verified almanac ----
const festivalBody = z.object({
  title: z.string().trim().min(3).max(120), slug: z.string().trim().max(90).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => !Number.isNaN(Date.parse(s)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s, 'Enter a real date as YYYY-MM-DD'),
  region: z.string().trim().min(2).max(80).default('India'), language: z.enum(['en', 'hi']).default('en'),
  tithi: z.string().trim().max(80).default(''), paksha: z.string().trim().max(40).default(''),
  description: z.string().trim().min(10).max(4000), status: z.enum(['draft', 'published']).default('draft'),
}).strict()
const festivalSlug = (s: string) => s.normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 90) || 'festival'
const uniqueFestivalSlug = (base: string, exceptId?: string) => {
  const root = festivalSlug(base), used = new Set(getDb().festivals.filter(f => f.id !== exceptId).map(f => f.slug))
  let slug = root, n = 2
  while (used.has(slug)) slug = `${root.slice(0, 84)}-${n++}`
  return slug
}
adminRouter.get('/festivals', requireAdminRole('content'), (req, res) => {
  const q = z.object({ year: z.coerce.number().int().min(2000).max(2100).optional(), status: z.enum(['draft', 'published']).optional() }).parse(req.query)
  const items = getDb().festivals.filter(f => (!q.year || f.date.startsWith(String(q.year))) && (!q.status || f.status === q.status)).sort((a, b) => a.date.localeCompare(b.date))
  ok(res, { total: items.length, items })
})
adminRouter.post('/festivals', requireAdminRole('content'), asyncHandler(async (req, res) => {
  const b = festivalBody.parse(req.body), now = new Date().toISOString()
  const item: Festival = { id: newId(), ...b, slug: uniqueFestivalSlug(b.slug || b.title), createdAt: now, updatedAt: now }
  getDb().festivals.push(item); audit(currentUser(res).id, 'festival.create', 'festival', item.id, { slug: item.slug, status: item.status }); save()
  ok(res, item, 201)
}))
adminRouter.patch('/festivals/:id', requireAdminRole('content'), asyncHandler(async (req, res) => {
  const b = festivalBody.parse(req.body), item = getDb().festivals.find(f => f.id === req.params.id)
  if (!item) throw new HttpError(404, 'NOT_FOUND', 'Festival not found')
  Object.assign(item, b, { slug: uniqueFestivalSlug(b.slug || b.title, item.id), updatedAt: new Date().toISOString() })
  audit(currentUser(res).id, 'festival.update', 'festival', item.id, { slug: item.slug, status: item.status }); save(); ok(res, item)
}))
adminRouter.delete('/festivals/:id', requireAdminRole('content'), (req, res) => {
  const db = getDb(), item = db.festivals.find(f => f.id === req.params.id)
  if (!item) throw new HttpError(404, 'NOT_FOUND', 'Festival not found')
  db.festivals = db.festivals.filter(f => f.id !== item.id); audit(currentUser(res).id, 'festival.delete', 'festival', item.id, { slug: item.slug }); save(); ok(res, { deleted: true })
})

adminRouter.patch('/horoscopes/:id', requireAdminRole('content'), asyncHandler(async (req, res) => {
  const body = z.object({ csv: z.string().min(1).max(12_000), status: z.enum(['draft', 'scheduled', 'published']) }).strict().parse(req.body)
  let parsed
  try { parsed = parseHoroscopeCsv(body.csv) } catch (e) { throw new HttpError(400, 'VALIDATION', (e as Error).message) }
  if (parsed.errors.length || parsed.rows.length !== 1) throw new HttpError(400, 'VALIDATION', parsed.errors[0]?.message ?? 'Provide exactly one valid horoscope row')
  const db = getDb(), row = parsed.rows[0]
  const item = db.horoscopes.find(h => h.id === req.params.id)
  if (!item) throw new HttpError(404, 'NOT_FOUND', 'Horoscope entry not found')
  const duplicate = db.horoscopes.find(h => h.id !== item.id && h.sign === row.sign && h.period === row.period && h.category === row.category && h.language === row.language && h.dateFrom === row.dateFrom)
  if (duplicate) throw new HttpError(409, 'DUPLICATE', 'Another entry already uses this sign, period, category, language and start date')
  Object.assign(item, row, { status: body.status, updatedAt: new Date().toISOString() })
  save(); ok(res, item)
}))

// ---- astrologer applications and management ----
adminRouter.get('/astrologers', requireAdminRole('super_admin'), (req, res) => {
  const status = z.enum(['pending', 'approved', 'rejected', 'suspended']).optional().parse(req.query.status)
  const items = getDb().astrologers.filter(a => !status || a.status === status).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(a => ({ id: a.id, ...publicAstrologer(a), applicationStatus: a.status, userId: a.userId, createdAt: a.createdAt }))
  ok(res, { total: items.length, items })
})

adminRouter.post('/astrologers/:id/status', requireAdminRole('super_admin'), asyncHandler(async (req, res) => {
  const { status } = z.object({ status: z.enum(['approved', 'rejected', 'suspended']) }).strict().parse(req.body)
  const db = getDb()
  const a = db.astrologers.find(x => x.id === req.params.id)
  if (!a) throw new HttpError(404, 'NOT_FOUND', 'Astrologer not found')
  if (a.status === 'pending' && status === 'suspended') throw new HttpError(400, 'VALIDATION', 'A pending application can be approved or rejected')
  a.status = status
  if (status !== 'approved') {
    a.isOnline = false; a.isBusy = false
    for (const watch of getDb().availabilityWatches) if (watch.astrologerId === a.id) watch.active = false
  }
  a.updatedAt = new Date().toISOString()
  const u = a.userId ? db.users.find(x => x.id === a.userId) : undefined
  if (u && u.role !== 'admin') u.role = status === 'approved' ? 'astrologer' : 'user'
  save()
  ok(res, { id: a.id, status: a.status })
}))

adminRouter.patch('/astrologers/:id/badge', requireAdminRole('super_admin'), (req, res) => {
  const { badge } = z.object({ badge: z.enum(['Featured', 'Rising Star']).nullable() }).strict().parse(req.body)
  const a = getDb().astrologers.find(x => x.id === req.params.id)
  if (!a) throw new HttpError(404, 'NOT_FOUND', 'Astrologer not found')
  if (a.status !== 'approved') throw new HttpError(409, 'NOT_APPROVED', 'Only approved astrologers can receive a public badge')
  a.badge = badge
  a.updatedAt = new Date().toISOString()
  audit(currentUser(res).id, 'astrologer.badge', 'astrologer', a.id, { badge })
  save()
  ok(res, { id: a.id, badge: a.badge })
})

adminRouter.delete('/astrologers/demo', requireAdminRole('super_admin'), (_req, res) => {
  const db = getDb(), ids = new Set(db.astrologers.filter(a => a.isDemo).map(a => a.id))
  db.astrologers = db.astrologers.filter(a => !ids.has(a.id))
  db.reviews = db.reviews.filter(r => !ids.has(r.astrologerId))
  save()
  ok(res, { removed: ids.size })
})

// ---- coupons and manual wallet adjustments (every change is written to the audit log) ----
adminRouter.get('/coupons', requireAdminRole('finance'), (_req, res) => ok(res, { items: getDb().coupons }))

adminRouter.post('/coupons', requireAdminRole('finance'), asyncHandler(async (req, res) => {
  const b = z.object({
    code: z.string().trim().min(3).max(30).regex(/^[A-Za-z0-9_-]+$/, 'Use letters, numbers, - or _'),
    type: z.enum(['percent', 'flat']), value: z.number().int().min(1),
    minAmountPaise: z.number().int().min(0).default(0), maxBonusPaise: z.number().int().min(0).default(0),
    validFrom: z.string().datetime(), validTo: z.string().datetime(), usageLimit: z.number().int().min(1).max(1_000_000),
  }).strict().refine(c => c.type !== 'percent' || (c.value <= 100 && c.maxBonusPaise > 0), 'A percent coupon needs value 1-100 and a maximum bonus').refine(c => c.validTo > c.validFrom, 'validTo must be after validFrom').parse(req.body)
  const code = normalizeCode(b.code)
  if (getDb().coupons.some(c => c.code === code)) throw new HttpError(409, 'EXISTS', 'That coupon code already exists')
  getDb().coupons.push({ ...b, code, usedCount: 0, active: true })
  audit(currentUser(res).id, 'coupon.create', 'coupon', code, b)
  ok(res, { code }, 201)
}))

adminRouter.post('/coupons/:code/active', requireAdminRole('finance'), asyncHandler(async (req, res) => {
  const { active } = z.object({ active: z.boolean() }).strict().parse(req.body)
  const c = getDb().coupons.find(x => x.code === normalizeCode(req.params.code))
  if (!c) throw new HttpError(404, 'NOT_FOUND', 'Coupon not found')
  c.active = active
  audit(currentUser(res).id, 'coupon.active', 'coupon', c.code, { active })
  ok(res, { code: c.code, active })
}))

adminRouter.post('/wallet/:userId/adjust', requireAdminRole('finance'), asyncHandler(async (req, res) => {
  const b = z.object({ amountPaise: z.number().int().refine(n => n !== 0 && Math.abs(n) <= 5_000_000, 'Amount must be non-zero and at most Rs 50,000'), type: z.enum(['refund', 'adjustment']).default('adjustment'), note: z.string().trim().min(5, 'Explain the reason (at least 5 characters)').max(200) }).strict().parse(req.body)
  const u = getDb().users.find(x => x.id === req.params.userId && !x.deletedAt)
  if (!u) throw new HttpError(404, 'NOT_FOUND', 'User not found')
  if (b.type === 'refund' && b.amountPaise < 0) throw new HttpError(400, 'VALIDATION', 'A refund must be a credit')
  const ref = newId()
  const tx = b.amountPaise > 0 ? creditWallet(u.id, b.type, b.amountPaise, 'admin', ref, b.note) : debitWallet(u.id, -b.amountPaise, 'admin', ref, b.note, 'adjustment')
  audit(currentUser(res).id, 'wallet.adjust', 'user', u.id, { amountPaise: b.amountPaise, type: b.type, note: b.note, txId: tx.id })
  ok(res, { balancePaise: getWallet(u.id).balancePaise, txId: tx.id })
}))

adminRouter.get('/sessions', requireAdminRole('finance'), (req, res) => {
  const flagged = req.query.flagged === 'true'
  const items = getDb().sessions.filter(s => s.status === 'ended' && (!flagged || s.refundStatus === 'flagged')).sort((a, b) => b.requestedAt - a.requestedAt).slice(0, 100)
    .map(s => ({ ...sessionView(s, 'user'), userId: s.userId, rating: getDb().reviews.find(r => r.id === s.reviewId)?.rating ?? null, comment: getDb().reviews.find(r => r.id === s.reviewId)?.comment ?? null }))
  ok(res, { items })
})
adminRouter.post('/sessions/:id/refund', requireAdminRole('finance'), asyncHandler(async (req, res) => {
  const b = z.object({ amountPaise: z.number().int().positive(), reason: z.string().trim().min(5).max(200) }).strict().parse(req.body)
  const s = refundSession(currentUser(res).id, String(req.params.id), b.amountPaise, b.reason)
  audit(currentUser(res).id, 'session.refund', 'session', s.id, { amountPaise: b.amountPaise, reason: b.reason })
  ok(res, { refundedPaise: s.refundedPaise })
}))
adminRouter.post('/sessions/:id/refund-decline', requireAdminRole('finance'), asyncHandler(async (req, res) => {
  const s = getDb().sessions.find(x => x.id === String(req.params.id))
  if (!s || s.refundStatus !== 'flagged') throw new HttpError(409, 'NOT_FLAGGED', 'This chat is not waiting for a refund decision')
  s.refundStatus = 'declined'; save(); audit(currentUser(res).id, 'session.refund_declined', 'session', s.id, {})
  ok(res, { refundStatus: s.refundStatus })
}))

adminRouter.get('/chat-reports', requireAdminRole('support'), (req, res) => {
  const status = z.enum(['open', 'actioned', 'dismissed', 'all']).default('open').parse(req.query.status)
  const db = getDb()
  const items = db.chatReports
    .filter(r => status === 'all' || r.status === status)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 100)
    .map(report => {
      const session = db.sessions.find(s => s.id === report.sessionId)
      const astrologer = session && db.astrologers.find(a => a.id === session.astrologerId)
      return {
        ...report,
        reporterName: db.users.find(u => u.id === report.reporterId)?.name || 'Deleted account',
        reportedName: report.reportedRole === 'astrologer' ? astrologer?.displayName ?? 'Unknown astrologer' : db.users.find(u => u.id === report.reportedUserId)?.name || 'Deleted account',
        sessionStatus: session?.status ?? 'unknown',
        transcript: db.messages.filter(m => m.sessionId === report.sessionId).slice(-50).map(m => ({ senderRole: m.senderRole, body: m.body, createdAt: new Date(m.createdAt).toISOString() })),
      }
    })
  ok(res, { items })
})

adminRouter.patch('/chat-reports/:id', requireAdminRole('support'), asyncHandler(async (req, res) => {
  const body = z.object({ status: z.enum(['actioned', 'dismissed']), note: z.string().trim().min(5).max(500) }).strict().parse(req.body)
  const report = getDb().chatReports.find(r => r.id === req.params.id)
  if (!report) throw new HttpError(404, 'NOT_FOUND', 'Chat report not found')
  if (report.status !== 'open') throw new HttpError(409, 'ALREADY_REVIEWED', 'This chat report has already been reviewed')
  report.status = body.status
  report.reviewedAt = new Date().toISOString()
  report.reviewerId = currentUser(res).id
  report.resolutionNote = body.note
  save()
  audit(currentUser(res).id, `chat_report.${body.status}`, 'chat_report', report.id, { sessionId: report.sessionId, reason: report.reason, note: body.note })
  ok(res, { id: report.id, status: report.status, reviewedAt: report.reviewedAt })
}))

adminRouter.get('/payouts', requireAdminRole('finance'), (req, res) => {
  const status = z.enum(['requested', 'approved', 'rejected', 'paid']).optional().parse(req.query.status)
  const db = getDb()
  const items = db.astrologerPayouts
    .filter(p => !status || p.status === status)
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))
    .slice(0, 200)
    .map(p => ({
      ...p,
      astrologerName: db.astrologers.find(a => a.id === p.astrologerId)?.displayName ?? 'Unknown astrologer',
    }))
  ok(res, { items })
})

adminRouter.post('/payouts/:id/status', requireAdminRole('finance'), asyncHandler(async (req, res) => {
  const body = z.object({
    status: z.enum(['approved', 'rejected', 'paid']),
    reference: z.string().trim().min(4).max(100).optional(),
  }).strict().superRefine((value, ctx) => {
    if (value.status === 'paid' && !value.reference) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['reference'], message: 'A transfer reference is required to mark a payout paid' })
    if (value.status !== 'paid' && value.reference !== undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['reference'], message: 'A transfer reference is only used when marking a payout paid' })
  }).parse(req.body)
  const payout = getDb().astrologerPayouts.find(p => p.id === req.params.id)
  if (!payout) throw new HttpError(404, 'NOT_FOUND', 'Payout request not found')
  const canDecide = payout.status === 'requested' && (body.status === 'approved' || body.status === 'rejected')
  const canMarkPaid = payout.status === 'approved' && body.status === 'paid'
  if (!canDecide && !canMarkPaid) throw new HttpError(409, 'INVALID_TRANSITION', `Cannot change payout from ${payout.status} to ${body.status}`)
  const now = new Date().toISOString()
  payout.status = body.status
  payout.reviewedAt = payout.reviewedAt ?? now
  if (body.status === 'paid') {
    if (!body.reference) throw new HttpError(400, 'VALIDATION', 'A transfer reference is required to mark a payout paid')
    payout.paidAt = now
    payout.reference = body.reference
  }
  audit(currentUser(res).id, `payout.${body.status}`, 'payout', payout.id, { amountPaise: payout.amountPaise, reference: payout.reference })
  save()
  ok(res, payout)
}))

// ---- support tickets ----
adminRouter.get('/support/tickets', requireAdminRole('support'), (req, res) => {
  const status = z.enum(['open', 'pending', 'resolved']).optional().parse(req.query.status)
  const db = getDb()
  const items = db.supportTickets.filter(t => !status || t.status === status).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 200).map(t => {
    const u = db.users.find(x => x.id === t.userId)
    return ticketView(t, { userName: u?.name || '(no name)', userPhone: u && !u.deletedAt ? u.phone : '' })
  })
  ok(res, { items })
})

adminRouter.get('/support/tickets/:id', requireAdminRole('support'), (req, res) => {
  const db = getDb(), t = db.supportTickets.find(x => x.id === req.params.id)
  if (!t) throw new HttpError(404, 'NOT_FOUND', 'Ticket not found')
  ok(res, { ticket: ticketView(t), messages: db.supportMessages.filter(m => m.ticketId === t.id).map(messageView) })
})

adminRouter.post('/support/tickets/:id/messages', requireAdminRole('support'), asyncHandler(async (req, res) => {
  const { body } = z.object({ body: z.string().trim().min(1).max(3000) }).strict().parse(req.body)
  const db = getDb(), t = db.supportTickets.find(x => x.id === req.params.id)
  if (!t) throw new HttpError(404, 'NOT_FOUND', 'Ticket not found')
  const now = new Date().toISOString(), me = currentUser(res)
  const m = { id: newId(), ticketId: t.id, senderId: me.id, senderRole: 'admin' as const, body, createdAt: now }
  db.supportMessages.push(m)
  t.status = 'pending'; t.updatedAt = now
  audit(me.id, 'support.reply', 'ticket', t.id, {})
  save()
  notifyUser(t.userId, 'support_reply', 'Support replied to your ticket', 'Our support team has replied. Open your ticket to read the message.', '/customer-support')
  ok(res, messageView(m), 201)
}))

adminRouter.post('/support/tickets/:id/status', requireAdminRole('support'), asyncHandler(async (req, res) => {
  const { status } = z.object({ status: z.enum(['open', 'pending', 'resolved']) }).strict().parse(req.body)
  const t = getDb().supportTickets.find(x => x.id === req.params.id)
  if (!t) throw new HttpError(404, 'NOT_FOUND', 'Ticket not found')
  t.status = status; t.updatedAt = new Date().toISOString()
  audit(currentUser(res).id, 'support.status', 'ticket', t.id, { status })
  save()
  ok(res, ticketView(t))
}))

// ---- blog ----
const adminPost = (p: ReturnType<typeof getDb>['blogPosts'][number]) => ({ id: p.id, ...postView(p, true), status: p.status, updatedAt: p.updatedAt })
const blogMediaDir = path.resolve(path.dirname(path.resolve(config.dataFile)), 'media', 'blog')
const blogImageTypes = new Map([
  ['image/jpeg', { ext: 'jpg', signature: (b: Buffer) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff }],
  ['image/png', { ext: 'png', signature: (b: Buffer) => b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) }],
  ['image/webp', { ext: 'webp', signature: (b: Buffer) => b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' }],
])

adminRouter.put('/blog/:id/cover', requireAdminRole('content'), express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '5mb' }), asyncHandler(async (req, res) => {
  const post = getDb().blogPosts.find(x => x.id === req.params.id)
  if (!post) throw new HttpError(404, 'NOT_FOUND', 'Article not found')
  const image = req.body
  const type = typeof req.headers['content-type'] === 'string' ? req.headers['content-type'].split(';')[0].trim().toLowerCase() : ''
  const format = blogImageTypes.get(type)
  if (!Buffer.isBuffer(image) || image.length === 0 || !format || !format.signature(image)) throw new HttpError(400, 'VALIDATION', 'Upload a valid JPEG, PNG or WebP image')
  await fs.mkdir(blogMediaDir, { recursive: true })
  const filename = `${randomUUID()}.${format.ext}`
  await fs.writeFile(path.join(blogMediaDir, filename), image, { flag: 'wx' })
  const oldUrl = post.coverImageUrl
  post.coverImageUrl = `/api/v1/blog/media/${filename}`
  post.updatedAt = new Date().toISOString()
  audit(currentUser(res).id, 'blog.cover.update', 'blog', post.id, { hasCoverImage: true })
  save()
  if (oldUrl && /^\/api\/v1\/blog\/media\/[a-f0-9-]{36}\.(jpg|png|webp)$/.test(oldUrl)) void fs.unlink(path.join(blogMediaDir, path.basename(oldUrl))).catch(() => {})
  ok(res, adminPost(post))
}))

adminRouter.delete('/blog/:id/cover', requireAdminRole('content'), asyncHandler(async (req, res) => {
  const post = getDb().blogPosts.find(x => x.id === req.params.id)
  if (!post) throw new HttpError(404, 'NOT_FOUND', 'Article not found')
  const oldUrl = post.coverImageUrl
  post.coverImageUrl = null
  post.updatedAt = new Date().toISOString()
  audit(currentUser(res).id, 'blog.cover.remove', 'blog', post.id, { hasCoverImage: false })
  save()
  if (oldUrl && /^\/api\/v1\/blog\/media\/[a-f0-9-]{36}\.(jpg|png|webp)$/.test(oldUrl)) void fs.unlink(path.join(blogMediaDir, path.basename(oldUrl))).catch(() => {})
  ok(res, adminPost(post))
}))

adminRouter.get('/blog', requireAdminRole('content'), (_req, res) => {
  ok(res, { items: getDb().blogPosts.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(adminPost) })
})

adminRouter.post('/blog', requireAdminRole('content'), asyncHandler(async (req, res) => {
  const b = postBody.parse(req.body), now = new Date().toISOString()
  const post = { id: newId(), ...b, slug: uniqueSlug(b.slug || b.title), isSample: false, publishedAt: b.status === 'published' ? now : null, createdAt: now, updatedAt: now }
  getDb().blogPosts.push(post)
  audit(currentUser(res).id, 'blog.create', 'blog', post.id, { slug: post.slug })
  save()
  ok(res, adminPost(post), 201)
}))

adminRouter.patch('/blog/:id', requireAdminRole('content'), asyncHandler(async (req, res) => {
  const post = getDb().blogPosts.find(x => x.id === req.params.id)
  if (!post) throw new HttpError(404, 'NOT_FOUND', 'Article not found')
  const b = postBody.parse(req.body), now = new Date().toISOString()
  const { slug, ...rest } = b
  Object.assign(post, rest, { slug: slug ? uniqueSlug(slug, post.id) : post.slug, updatedAt: now })
  if (post.status === 'published' && !post.publishedAt) post.publishedAt = now // keeps the original date when edited later
  audit(currentUser(res).id, 'blog.update', 'blog', post.id, { status: post.status })
  save()
  ok(res, adminPost(post))
}))

adminRouter.delete('/blog/:id', requireAdminRole('content'), (req, res) => {
  const db = getDb(), i = db.blogPosts.findIndex(x => x.id === req.params.id)
  if (i < 0) throw new HttpError(404, 'NOT_FOUND', 'Article not found')
  const [gone] = db.blogPosts.splice(i, 1)
  audit(currentUser(res).id, 'blog.delete', 'blog', gone.id, { slug: gone.slug })
  save()
  if (gone.coverImageUrl && /^\/api\/v1\/blog\/media\/[a-f0-9-]{36}\.(jpg|png|webp)$/.test(gone.coverImageUrl)) void fs.unlink(path.join(blogMediaDir, path.basename(gone.coverImageUrl))).catch(() => {})
  ok(res, { deleted: true })
})
