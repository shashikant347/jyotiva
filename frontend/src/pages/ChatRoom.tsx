import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { rupees } from '../astrologers/types'
import KundliQuick from '../chat/KundliQuick'
import type { SessionView } from '../chat/types'
import { clock, useChat, useNow } from '../chat/useChat'
import { usePrefs } from '../context/PrefsContext'
import { usePageMeta } from '../hooks'
import { api, isApiError } from '../services/api'

const STOP_REASONS = ['astrologer_rejected', 'timeout', 'user_cancelled', 'user_balance', 'server_restart']

function ReviewBox({ id, onDone }: { id: string; onDone: () => void }) {
  const { t } = usePrefs()
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!rating) { setErr(t('chat.pickStar')); return }
    setBusy(true); setErr('')
    try { await api(`/sessions/${id}/review`, { method: 'POST', body: { rating, comment } }); onDone() }
    catch (x) { setErr(isApiError(x) ? x.message : t('chat.err')) } finally { setBusy(false) }
  }
  return (
    <form className="panel" onSubmit={submit}>
      <h2>{t('chat.rateTitle')}</h2>
      <div className="stars" role="radiogroup" aria-label={t('chat.stars')}>
        {[1, 2, 3, 4, 5].map(n => (
          <button type="button" key={n} role="radio" aria-checked={rating === n} aria-label={t('chat.star1', { n })} className={n <= rating ? 'on' : ''} onClick={() => setRating(n)}>★</button>
        ))}
      </div>
      <div className="field"><label htmlFor="rv">{t('chat.comment')}</label><textarea id="rv" rows={3} maxLength={500} value={comment} onChange={e => setComment(e.target.value)} /></div>
      {rating > 0 && rating <= 2 && <p className="notice">{t('chat.lowNote')}</p>}
      {err && <p className="alert" role="alert">{err}</p>}
      <div className="row"><button className="btn btn-gold" disabled={busy}>{busy ? t('chat.saving') : t('chat.submitReview')}</button></div>
    </form>
  )
}

function ReportBox({ id, onDone }: { id: string; onDone: () => void }) {
  const { t } = usePrefs()
  const [reason, setReason] = useState<'harassment' | 'abuse' | 'spam' | 'inappropriate' | 'other'>('abuse')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setErr('')
    try { await api(`/sessions/${id}/report`, { method: 'POST', body: { reason, details } }); onDone() }
    catch (e) { setErr(isApiError(e) ? e.message : t('chat.err')) }
    finally { setBusy(false) }
  }
  return <form className="panel" onSubmit={submit}>
    <h2>{t('chat.reportTitle')}</h2>
    <p className="muted small">{t('chat.reportIntro')}</p>
    <label className="field" htmlFor="report-reason">{t('chat.reportReason')}<select id="report-reason" value={reason} onChange={e => setReason(e.target.value as typeof reason)}>
      {(['harassment', 'abuse', 'spam', 'inappropriate', 'other'] as const).map(v => <option key={v} value={v}>{t(`chat.report.${v}`)}</option>)}
    </select></label>
    <label className="field" htmlFor="report-details">{t('chat.reportDetails')}<textarea id="report-details" rows={4} minLength={10} maxLength={1200} required value={details} onChange={e => setDetails(e.target.value)} /></label>
    {err && <p className="alert" role="alert">{err}</p>}
    <button className="btn btn-line" disabled={busy || details.trim().length < 10}>{busy ? t('chat.saving') : t('chat.reportSubmit')}</button>
  </form>
}

export default function ChatRoom() {
  const { t } = usePrefs()
  usePageMeta(t('chat.title'), { noindex: true })
  const { id = '' } = useParams()
  const c = useChat(id)
  const s = c.session
  const [text, setText] = useState('')
  const [sendErr, setSendErr] = useState('')
  const [sending, setSending] = useState(false)
  const [actErr, setActErr] = useState('')
  const [bal0, setBal0] = useState<number | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const typingOff = useRef<ReturnType<typeof setTimeout>>()
  const typingOn = useRef(false)

  const live = s?.status === 'requested' || s?.status === 'active'
  const now = useNow(live)
  const role = s?.viewerRole
  const status = s?.status
  const errText = (e: unknown): string => (isApiError(e) ? e.message : t('chat.err'))

  // Wallet balance before the first live update arrives (and the final balance after the chat).
  useEffect(() => {
    if (role !== 'user') return
    api<{ balancePaise: number }>('/sessions/status').then(r => setBal0(r.balancePaise)).catch(() => {})
  }, [role, status])

  useEffect(() => { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight }, [c.messages.length, c.typing])

  const { markRead } = c
  useEffect(() => {
    if (!role) return
    const unread = c.messages.some(m => m.senderRole !== 'system' && m.senderRole !== role && !m.read)
    if (unread && document.visibilityState === 'visible') markRead()
  }, [c.messages, role, markRead])

  useEffect(() => () => clearTimeout(typingOff.current), [])

  function onType(v: string) {
    setText(v)
    if (!typingOn.current) { typingOn.current = true; c.setTypingOn(true) }
    clearTimeout(typingOff.current)
    typingOff.current = setTimeout(() => { typingOn.current = false; c.setTypingOn(false) }, 2000)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const body = text.trim()
    if (!body || sending) return
    setSending(true); setSendErr('')
    try {
      await c.send(body)
      setText('')
      clearTimeout(typingOff.current)
      if (typingOn.current) { typingOn.current = false; c.setTypingOn(false) }
    } catch (x) { setSendErr((x as Error).message) } finally { setSending(false) }
  }

  async function act(path: 'end' | 'cancel' | 'accept' | 'reject') {
    setActErr('')
    try { c.setSession((await api<{ session: SessionView }>(`/sessions/${id}/${path}`, { method: 'POST' })).session) }
    catch (x) { setActErr(errText(x)) }
  }
  const endChat = () => { if (window.confirm(t('chat.endConfirm'))) void act('end') }

  if (c.error && !s) {
    return <section className="wrap sec"><h1 className="page-h">{t('chat.title')}</h1><p className="alert" role="alert">{c.error}</p><p><Link to="/order-history">{t('chat.backChats')}</Link></p></section>
  }
  if (!s) return <section className="wrap sec"><p className="muted">{c.connected ? t('chat.opening') : t('chat.connecting')}</p></section>

  const isUser = s.viewerRole === 'user'
  const other = isUser ? s.astrologer.displayName : s.birth.name
  const startedMs = s.startedAt ? Date.parse(s.startedAt) : 0
  const elapsed = s.status === 'active' ? (now - startedMs) / 1000 : s.durationSeconds
  const billed = Math.max(c.billedMinutes ?? 0, s.billedMinutes)
  const charged = s.isFree ? 0 : Math.max(billed * s.pricePerMinPaise, s.amountChargedPaise ?? 0)
  const balance = c.balancePaise ?? bal0
  const nextCharge = (startedMs + billed * 60_000 - now) / 1000
  const freeLeft = s.paidUntil ? (Date.parse(s.paidUntil) - now) / 1000 : 0
  const expiresIn = (Date.parse(s.requestExpiresAt) - now) / 1000
  const lastMine = [...c.messages].reverse().find(m => m.senderRole === s.viewerRole)
  const canWrite = s.status === 'active' && c.connected
  const b = s.birth
  const genderText = b.gender === 'male' ? t('chat.male') : b.gender === 'female' ? t('chat.female') : b.gender ? t('chat.other') : ''

  return (
    <section className="wrap sec chat">
      <div className="chat-top">
        <h1 className="page-h">{t('chat.with', { name: other })}</h1>
        <span className={'pill ' + s.status}>{s.status === 'requested' ? t('chat.waiting') : s.status === 'active' ? t('chat.live') : t('chat.closed')}</span>
      </div>

      {s.astrologer.isDemo && <p className="notice">{t('chat.demo')}</p>}
      {live && !c.connected && <p className="alert" role="status">{t('chat.reconnecting')}</p>}
      {actErr && <p className="alert" role="alert">{actErr}</p>}

      <details className="panel birth" open={s.status !== 'ended'}>
        <summary>{t('chat.birthTitle')}</summary>
        <table className="tbl kv"><tbody>
          <tr><th scope="row">{t('chat.name')}</th><td>{b.name}</td></tr>
          {genderText && <tr><th scope="row">{t('chat.gender')}</th><td>{genderText}</td></tr>}
          <tr><th scope="row">{t('chat.dob')}</th><td>{b.birthDate}</td></tr>
          <tr><th scope="row">{t('chat.tob')}</th><td>{b.birthTime ?? t('chat.unknown')}</td></tr>
          <tr><th scope="row">{t('chat.pob')}</th><td>{b.birthPlace}</td></tr>
        </tbody></table>
      </details>
      <KundliQuick birth={b} />

      {s.status === 'requested' && (
        <div className="panel">
          {isUser ? <>
            <p><b>{t('chat.waitingFor', { name: other })}</b> {expiresIn > 0 ? t('chat.closesIn', { time: clock(expiresIn) }) : t('chat.checking')}</p>
            <p className="muted small">{s.isFree ? t('chat.freeNoCharge') : t('chat.billingStarts')}</p>
            <div className="row"><button className="btn btn-line" onClick={() => void act('cancel')}>{t('chat.cancelReq')}</button></div>
          </> : <>
            <p><b>{t('chat.wantsChat', { name: b.name })}</b> {t('chat.closesIn', { time: clock(expiresIn) })}</p>
            <div className="row"><button className="btn btn-gold" onClick={() => void act('accept')}>{t('chat.accept')}</button><button className="btn btn-line" onClick={() => void act('reject')}>{t('chat.decline')}</button></div>
          </>}
        </div>
      )}

      {s.status === 'active' && (
        <div className="chat-bar" role="status">
          {s.isFree
            ? <span><b>{t('chat.freeChat')}</b> · {t('chat.left', { time: clock(freeLeft) })}</span>
            : <span><b>{clock(elapsed)}</b> · {t('chat.perMin', { price: rupees(s.pricePerMinPaise) })}</span>}
          {isUser && !s.isFree && <span>{t('chat.charged', { amount: rupees(charged), time: clock(nextCharge) })}</span>}
          {isUser && balance !== null && <span>{t('chat.wallet', { amount: rupees(balance) })}</span>}
          <button className="btn btn-line sm" onClick={endChat}>{t('chat.end')}</button>
        </div>
      )}
      {isUser && c.low && s.status === 'active' && (
        <p className="notice" role="alert">{t('chat.lowBalance')} <Link to="/my-wallet" target="_blank" rel="noopener">{t('chat.addMoney')}</Link> {t('chat.newTab')}</p>
      )}

      {(s.status === 'active' || s.status === 'ended' || c.messages.length > 0) && (
        <div className="panel chat-box">
          <div className="chat-log" ref={listRef} role="log" aria-live="polite" aria-label={t('chat.messages')}>
            {c.messages.length === 0 && <p className="empty">{t('chat.noMessages')}</p>}
            {c.messages.map(m => m.senderRole === 'system'
              ? <p key={m.id} className="msg-sys">{m.body}</p>
              : (
                <div key={m.id} className={'msg ' + (m.senderRole === s.viewerRole ? 'mine' : 'theirs')}>
                  <p>{m.body}</p>
                  <small>{new Date(m.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}{lastMine?.id === m.id && m.read ? ` · ${t('chat.seen')}` : ''}</small>
                </div>
              ))}
            {c.typing && <p className="msg-sys">{t('chat.typing', { name: other })}</p>}
          </div>
          {s.status === 'active' && (
            <form className="chat-form" onSubmit={submit}>
              <label htmlFor="msg" className="sr">{t('chat.message')}</label>
              <input id="msg" value={text} maxLength={2000} autoComplete="off" placeholder={canWrite ? t('chat.placeholder') : t('chat.waitConn')} disabled={!canWrite} onChange={e => onType(e.target.value)} />
              <button className="btn btn-gold" disabled={!canWrite || sending || !text.trim()}>{t('chat.send')}</button>
            </form>
          )}
          {sendErr && <p className="alert" role="alert">{sendErr}</p>}
        </div>
      )}

      {s.status !== 'requested' && s.status !== 'active' && (
        <div className="panel">
          {s.status === 'ended' ? <>
            <h2>{t('chat.ended')}</h2>
            <p>{t('chat.length', { time: clock(s.durationSeconds) })}{' '}
              {isUser
                ? (s.isFree ? t('chat.wasFree') : t('chat.chargedFor', { amount: rupees(s.amountChargedPaise ?? 0), n: s.billedMinutes, unit: t(s.billedMinutes === 1 ? 'chat.minute' : 'chat.minutes') }))
                : t('chat.earning', { amount: rupees(s.astrologerEarningPaise ?? 0) })}
            </p>
            {isUser && s.refundStatus === 'flagged' && <p className="notice">{t('chat.refundFlag')}</p>}
            {isUser && s.refundStatus === 'refunded' && <p className="notice">{t('chat.refunded', { amount: rupees(s.refundedPaise ?? 0) })}</p>}
          </> : <><h2>{t('chat.reqClosed')}</h2><p>{STOP_REASONS.includes(s.endReason ?? '') ? t('chat.stop.' + s.endReason) : t('chat.reqClosedDefault')}</p></>}
          <div className="row">
            {isUser && <Link className="btn btn-gold" to={`/chat-with/${s.astrologer.slug}`}>{t('chat.again')}</Link>}
            <Link className="btn btn-line" to={isUser ? '/order-history' : '/astrologer-panel'}>{isUser ? t('chat.orderHistory') : t('chat.backRequests')}</Link>
          </div>
        </div>
      )}

      {isUser && s.status === 'ended' && !s.reviewed && !s.astrologer.isDemo && (
        <ReviewBox id={s.id} onDone={() => c.setSession({ ...s, reviewed: true })} />
      )}
      {isUser && s.status === 'ended' && s.reviewed && <p className="muted small">{t('chat.thanks')}</p>}

      {(s.status === 'active' || s.status === 'ended') && !s.astrologer.isDemo && (s.reported
        ? <p className="notice" role="status">{t('chat.reported')}</p>
        : <ReportBox id={s.id} onDone={() => c.setSession({ ...s, reported: true })} />)}

      <p className="muted small">{t('chat.disclaimer')}</p>
    </section>
  )
}
