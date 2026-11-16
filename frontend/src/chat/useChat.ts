import { useCallback, useEffect, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'
import { openSocket } from './socket'
import type { ChatMsg, SessionView } from './types'

interface JoinAck { ok: boolean; message?: string; session?: SessionView; messages?: ChatMsg[] }
interface SendAck { ok: boolean; message?: string }

/** Live state of one chat: the session, its messages, typing, and the money updates the server pushes. */
export function useChat(sessionId: string) {
  const [session, setSession] = useState<SessionView | null>(null)
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState('')
  const [typing, setTyping] = useState(false)
  const [balancePaise, setBalancePaise] = useState<number | null>(null)
  const [billedMinutes, setBilledMinutes] = useState<number | null>(null)
  const [low, setLow] = useState(false)
  const sock = useRef<Socket | null>(null)

  useEffect(() => {
    const s = openSocket()
    sock.current = s
    let typingTimer: ReturnType<typeof setTimeout> | undefined
    const join = () => s.emit('session:join', { sessionId }, (r: JoinAck) => {
      if (r?.ok && r.session) { setSession(r.session); setMessages(r.messages ?? []); setError('') }
      else setError(r?.message ?? 'Could not open this chat')
    })
    s.on('connect', () => { setConnected(true); join() }) // runs again after every reconnect, which also refreshes the state
    s.on('disconnect', () => setConnected(false))
    s.on('connect_error', () => setConnected(false))
    const onSession = (v: SessionView) => { if (v.id === sessionId) setSession(v) }
    s.on('session:update', onSession)
    s.on('session:requested', onSession)
    s.on('message:new', (m: ChatMsg) => {
      if (m.sessionId !== sessionId) return
      setMessages(prev => (prev.some(x => x.id === m.id) ? prev : [...prev, m]))
      if (m.senderRole !== 'system') setTyping(false)
    })
    s.on('message:read', (r: { sessionId: string; by: 'user' | 'astrologer' }) => {
      if (r.sessionId !== sessionId) return
      // "by" read the other side's messages, so those messages are now seen.
      setMessages(prev => prev.map(m => (m.senderRole !== 'system' && m.senderRole !== r.by ? { ...m, read: true } : m)))
    })
    s.on('typing', (p: { on: boolean }) => {
      setTyping(!!p.on)
      clearTimeout(typingTimer)
      if (p.on) typingTimer = setTimeout(() => setTyping(false), 4000)
    })
    s.on('balance:update', (b: { sessionId: string; balancePaise: number; billedMinutes: number }) => {
      if (b.sessionId !== sessionId) return
      setBalancePaise(b.balancePaise); setBilledMinutes(b.billedMinutes); setLow(false)
    })
    s.on('balance:low', (b: { sessionId: string; balancePaise: number }) => {
      if (b.sessionId !== sessionId) return
      setBalancePaise(b.balancePaise); setLow(true)
    })
    return () => { clearTimeout(typingTimer); s.disconnect(); sock.current = null }
  }, [sessionId])

  const send = useCallback((body: string) => new Promise<void>((resolve, reject) => {
    const s = sock.current
    if (!s || !s.connected) { reject(new Error('You are offline. Reconnecting…')); return }
    s.timeout(8000).emit('message:send', { sessionId, body }, (err: Error | null, r: SendAck) => {
      if (err) reject(new Error('The server did not answer. Try again.'))
      else if (!r?.ok) reject(new Error(r?.message ?? 'Message not sent'))
      else resolve()
    })
  }), [sessionId])

  const setTypingOn = useCallback((on: boolean) => { sock.current?.emit('typing', { sessionId, on }) }, [sessionId])
  const markRead = useCallback(() => { sock.current?.emit('message:read', { sessionId }) }, [sessionId])

  return { session, setSession, messages, connected, error, typing, balancePaise, setBalancePaise, billedMinutes, low, send, setTypingOn, markRead }
}

/** Re-renders every `ms` while `on` is true; returns the current time. */
export function useNow(on: boolean, ms = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!on) return
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(t)
  }, [on, ms])
  return now
}

export const clock = (totalSeconds: number): string => {
  const s = Math.max(0, Math.floor(totalSeconds))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
