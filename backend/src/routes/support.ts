import { Router } from 'express'
import { z } from 'zod'
import { HttpError } from '../errors.js'
import { asyncHandler, ok } from '../http.js'
import { currentUser, requireAuth } from '../middleware/auth.js'
import { supportLimiter } from '../middleware/rateLimit.js'
import { getDb, newId, save, type SupportMessage, type SupportTicket } from '../store.js'

export const supportRouter = Router()
supportRouter.use(requireAuth)

export const CATEGORIES = ['payment', 'chat', 'astrologer', 'account', 'other'] as const
const MAX_OPEN = 5

export const ticketView = (t: SupportTicket, extra: Record<string, unknown> = {}) => ({
  id: t.id, category: t.category, subject: t.subject, status: t.status, relatedSessionId: t.relatedSessionId, createdAt: t.createdAt, updatedAt: t.updatedAt, ...extra,
})
export const messageView = (m: SupportMessage) => ({ id: m.id, senderRole: m.senderRole, body: m.body, createdAt: m.createdAt })

const createBody = z.object({
  category: z.enum(CATEGORIES), subject: z.string().trim().min(3, 'Write a short subject').max(120),
  message: z.string().trim().min(10, 'Please describe the problem in a few words').max(3000),
  relatedSessionId: z.string().max(80).optional(),
}).strict()
const messageBody = z.object({ body: z.string().trim().min(1, 'Write a message').max(3000) }).strict()

const mine = (userId: string, id: string): SupportTicket => {
  const t = getDb().supportTickets.find(x => x.id === id && x.userId === userId)
  if (!t) throw new HttpError(404, 'NOT_FOUND', 'Ticket not found')
  return t
}
const lastMessage = (id: string): string | null => {
  const m = getDb().supportMessages.filter(x => x.ticketId === id).at(-1)
  return m ? m.createdAt : null
}

supportRouter.get('/tickets', (_req, res) => {
  const u = currentUser(res)
  const items = getDb().supportTickets.filter(t => t.userId === u.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(t => ticketView(t, { lastMessageAt: lastMessage(t.id) }))
  ok(res, { items })
})

supportRouter.post('/tickets', supportLimiter, asyncHandler(async (req, res) => {
  const u = currentUser(res), b = createBody.parse(req.body), db = getDb()
  if (db.supportTickets.filter(t => t.userId === u.id && t.status !== 'resolved').length >= MAX_OPEN) throw new HttpError(429, 'TOO_MANY_OPEN', `You already have ${MAX_OPEN} open tickets. Please wait for a reply or close one.`)
  // A linked chat must be the user's own, so nobody can attach somebody else's session to a ticket.
  if (b.relatedSessionId && !db.sessions.some(s => s.id === b.relatedSessionId && s.userId === u.id)) throw new HttpError(400, 'VALIDATION', 'That chat was not found in your history')
  const now = new Date().toISOString()
  const t: SupportTicket = { id: newId(), userId: u.id, category: b.category, subject: b.subject, status: 'open', relatedSessionId: b.relatedSessionId ?? null, createdAt: now, updatedAt: now }
  db.supportTickets.push(t)
  db.supportMessages.push({ id: newId(), ticketId: t.id, senderId: u.id, senderRole: 'user', body: b.message, createdAt: now })
  save()
  ok(res, ticketView(t), 201)
}))

supportRouter.get('/tickets/:id', (req, res) => {
  const t = mine(currentUser(res).id, String(req.params.id))
  ok(res, { ticket: ticketView(t), messages: getDb().supportMessages.filter(m => m.ticketId === t.id).map(messageView) })
})

supportRouter.post('/tickets/:id/messages', supportLimiter, asyncHandler(async (req, res) => {
  const u = currentUser(res), t = mine(u.id, String(req.params.id)), { body } = messageBody.parse(req.body)
  if (t.status === 'resolved') throw new HttpError(409, 'TICKET_CLOSED', 'This ticket is closed. Please open a new one.')
  const now = new Date().toISOString()
  const m: SupportMessage = { id: newId(), ticketId: t.id, senderId: u.id, senderRole: 'user', body, createdAt: now }
  getDb().supportMessages.push(m)
  t.status = 'open'; t.updatedAt = now
  save()
  ok(res, messageView(m), 201)
}))

supportRouter.post('/tickets/:id/close', (req, res) => {
  const t = mine(currentUser(res).id, String(req.params.id))
  t.status = 'resolved'; t.updatedAt = new Date().toISOString()
  save()
  ok(res, ticketView(t))
})
