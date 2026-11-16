import { Router } from 'express'
import { z } from 'zod'
import { HttpError } from '../errors.js'
import { asyncHandler, ok } from '../http.js'
import { currentUser, requireAuth } from '../middleware/auth.js'
import { sessionLimiter } from '../middleware/rateLimit.js'
import { acceptSession, cancelSession, createSession, endByParticipant, freeChatAvailable, getSession, incomingFor, messagesOf, mySessions, openSessionOf, rejectSession, reportSession, reviewSession, rules, roleOf, sessionView, viewFor } from '../sessions/service.js'
import { getWallet } from '../wallet/service.js'


export const sessionsRouter = Router()
sessionsRouter.use(requireAuth)

/** What the "start chat" screen needs: free chat eligibility, balance and any chat already open. */
sessionsRouter.get('/status', (_req, res) => {
  const u = currentUser(res), open = openSessionOf(u.id)
  ok(res, { freeChatAvailable: freeChatAvailable(u), freeChatMinutes: Math.round(rules.freeChatSeconds / 60), minBalanceMinutes: rules.minBalanceMinutes, balancePaise: getWallet(u.id).balancePaise, openSessionId: open?.id ?? null })
})

sessionsRouter.get('/mine', (_req, res) => {
  const u = currentUser(res)
  ok(res, { items: mySessions(u.id).map(s => sessionView(s, 'user')) })
})

sessionsRouter.get('/incoming', (_req, res) => {
  ok(res, { items: incomingFor(currentUser(res).id).map(s => sessionView(s, 'astrologer')) })
})

const createBody = z.object({ astrologerSlug: z.string().min(1).max(80), birthProfileId: z.string().min(1).max(64), free: z.boolean().optional() }).strict()
sessionsRouter.post('/', sessionLimiter, asyncHandler(async (req, res) => {
  const s = createSession(currentUser(res), createBody.parse(req.body))
  ok(res, { session: sessionView(s, 'user') }, 201)
}))

sessionsRouter.get('/:id', (req, res) => {
  const s = getSession(String(req.params.id))
  ok(res, { session: viewFor(s, currentUser(res).id) })
})
sessionsRouter.get('/:id/messages', (req, res) => {
  const s = getSession(String(req.params.id))
  if (!roleOf(s, currentUser(res).id)) throw new HttpError(403, 'FORBIDDEN', 'This is not your chat')
  ok(res, { items: messagesOf(s).map(m => ({ id: m.id, senderRole: m.senderRole, body: m.body, createdAt: new Date(m.createdAt).toISOString(), read: !!m.readAt })) })
})

const act = (fn: (userId: string, id: string) => ReturnType<typeof acceptSession>) => asyncHandler(async (req, res) => {
  const u = currentUser(res), s = fn(u.id, String(req.params.id))
  ok(res, { session: viewFor(s, u.id) })
})
sessionsRouter.post('/:id/accept', act(acceptSession))
sessionsRouter.post('/:id/reject', act(rejectSession))
sessionsRouter.post('/:id/cancel', act(cancelSession))
sessionsRouter.post('/:id/end', act(endByParticipant))

const reviewBody = z.object({ rating: z.number().int().min(1).max(5), comment: z.string().trim().max(500).default('') }).strict()
sessionsRouter.post('/:id/review', asyncHandler(async (req, res) => {
  const b = reviewBody.parse(req.body), u = currentUser(res)
  const r = reviewSession(u.id, String(req.params.id), b.rating, b.comment)
  ok(res, { review: { rating: r.rating, comment: r.comment } }, 201)
}))

const reportBody = z.object({
  reason: z.enum(['harassment', 'abuse', 'spam', 'inappropriate', 'other']),
  details: z.string().trim().min(10, 'Add at least 10 characters so our team can review the report').max(1200),
}).strict()
sessionsRouter.post('/:id/report', sessionLimiter, asyncHandler(async (req, res) => {
  const body = reportBody.parse(req.body)
  const report = reportSession(currentUser(res).id, String(req.params.id), body.reason, body.details)
  ok(res, { report: { id: report.id, status: report.status, createdAt: report.createdAt } }, 201)
}))
