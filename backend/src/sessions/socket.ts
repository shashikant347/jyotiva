import type { Server as HttpServer } from 'node:http'
import { Server } from 'socket.io'
import { verifyAccess } from '../auth/tokens.js'
import { config } from '../config.js'
import { getDb, type User } from '../store.js'
import { notificationBus, notifyAvailability } from '../notifications/service.js'
import { sendPushToUser } from '../notifications/push.js'
import { enablePresenceTracking, presenceBus, registerAstrologerSocket, unregisterAstrologerSocket } from '../astrologers/presence.js'
import { getSession, markAbsent, markPresent, markRead, messagesOf, roleOf, sendMessage, endByParticipant, astrologerOf, bus, sessionView, viewFor } from './service.js'

type Ack = (r: unknown) => void
const fail = (e: unknown) => ({ ok: false, code: (e as { code?: string }).code ?? 'ERROR', message: (e as Error).message ?? 'Something went wrong' })
const wrap = (ack: unknown, fn: () => unknown): void => {
  const cb: Ack = typeof ack === 'function' ? (ack as Ack) : () => {}
  try { cb({ ok: true, ...(fn() as object) }) } catch (e) { cb(fail(e)) }
}
const str = (v: unknown, max = 80): string => (typeof v === 'string' && v.length <= max ? v : '')

export function attachSockets(httpServer: HttpServer): Server {
  enablePresenceTracking()
  const io = new Server(httpServer, { cors: { origin: config.corsOrigins }, maxHttpBufferSize: 16 * 1024 })

  io.use((socket, next) => {
    const claims = verifyAccess(str(socket.handshake.auth?.token, 2000))
    const user = claims && getDb().users.find(u => u.id === claims.sub && !u.deletedAt && u.status !== 'suspended')
    if (!user) return next(new Error('UNAUTHORIZED'))
    socket.data.user = user
    next()
  })

  io.on('connection', socket => {
    const user = socket.data.user as User
    const joined = new Set<string>()
    const sent: number[] = []
    socket.join('user:' + user.id)
    registerAstrologerSocket(user.id, socket.id)

    socket.on('session:join', (p: { sessionId?: string }, ack: unknown) => wrap(ack, () => {
      const s = getSession(str(p?.sessionId)), role = roleOf(s, user.id)
      if (!role) throw Object.assign(new Error('This is not your chat'), { code: 'FORBIDDEN' })
      socket.join('session:' + s.id); joined.add(s.id); markPresent(s.id, socket.id)
      return { session: viewFor(s, user.id), messages: messagesOf(s).map(m => ({ id: m.id, senderRole: m.senderRole, body: m.body, createdAt: new Date(m.createdAt).toISOString(), read: !!m.readAt })) }
    }))

    socket.on('message:send', (p: { sessionId?: string; body?: string }, ack: unknown) => wrap(ack, () => {
      const now = Date.now()
      while (sent.length && now - sent[0] > 10_000) sent.shift()
      if (sent.length >= 20) throw Object.assign(new Error('You are sending messages too fast'), { code: 'RATE_LIMITED' })
      sent.push(now)
      const m = sendMessage(user.id, str(p?.sessionId), typeof p?.body === 'string' ? p.body : '')
      return { id: m.id }
    }))

    socket.on('typing', (p: { sessionId?: string; on?: boolean }) => {
      const id = str(p?.sessionId); if (!joined.has(id)) return
      const role = roleOf(getSession(id), user.id)
      if (role) socket.to('session:' + id).emit('typing', { role, on: !!p?.on })
    })
    socket.on('message:read', (p: { sessionId?: string }) => { const id = str(p?.sessionId); if (joined.has(id)) try { markRead(user.id, id) } catch { /* gone */ } })
    socket.on('session:end', (p: { sessionId?: string }, ack: unknown) => wrap(ack, () => ({ session: viewFor(endByParticipant(user.id, str(p?.sessionId)), user.id) })))
    socket.on('disconnect', () => {
      unregisterAstrologerSocket(user.id, socket.id)
      for (const id of joined) markAbsent(id, socket.id)
    })
  })

  // service events -> rooms. Views differ per role (the user sees what was charged, the astrologer what was earned).
  bus.on('session', (s: ReturnType<typeof getSession>) => {
    const a = astrologerOf(s)
    io.to('user:' + s.userId).emit('session:update', sessionView(s, 'user'))
    if (a.userId) {
      io.to('user:' + a.userId).emit(s.status === 'requested' ? 'session:requested' : 'session:update', sessionView(s, 'astrologer'))
      if (s.status === 'requested') void sendPushToUser(a.userId, { title: 'New chat request', body: 'A user has requested a chat with you.', href: '/astrologer-panel' }).catch(e => console.warn('Could not send chat request push:', (e as Error).message))
    }
  })
  bus.on('message', (m: { sessionId: string }) => io.to('session:' + m.sessionId).emit('message:new', { ...m, createdAt: new Date((m as unknown as { createdAt: number }).createdAt).toISOString() }))
  bus.on('read', (r: { sessionId: string }) => io.to('session:' + r.sessionId).emit('message:read', r))
  bus.on('balance', (b: { userId: string }) => io.to('user:' + b.userId).emit('balance:update', b))
  bus.on('low', (b: { userId: string }) => io.to('user:' + b.userId).emit('balance:low', b))
  notificationBus.on('new', (n: { userId: string; id: string; type: string; title: string; body: string; href: string; readAt: string | null; createdAt: string }) => {
    const { userId, ...notification } = n
    io.to('user:' + userId).emit('notification:new', notification)
    void sendPushToUser(userId, notification).catch(e => console.warn('Could not send notification push:', (e as Error).message))
  })
  presenceBus.on('online', (astrologerId: string) => {
    const astrologer = getDb().astrologers.find(a => a.id === astrologerId)
    if (astrologer) notifyAvailability(astrologer)
  })
  return io
}
