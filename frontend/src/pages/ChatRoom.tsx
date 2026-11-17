import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { rupees } from '../astrologers/types'
import KundliQuick from '../chat/KundliQuick'
import type { SessionView } from '../chat/types'
import { clock, useChat, useNow } from '../chat/useChat'
import { usePrefs } from '../context/PrefsContext'
import { usePageMeta } from '../hooks'
import { api, isApiError } from '../services/api'
import './chat-room.css'

const STOP_REASONS = ['astrologer_rejected', 'timeout', 'user_cancelled', 'user_balance', 'server_restart']

/* ---------- small inline icons ---------- */
const SendIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4 20-7Z" /></svg>
)
const BackIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
)
const InfoIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>
)
const CloseIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
)
const Ticks = ({ seen }: { seen: boolean }) => (
  <svg className={'cr-ticks' + (seen ? ' seen' : '')} viewBox="0 0 18 12" width="16" height="11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m1 6.5 3.5 3.5L11 2" /><path d="m7 10 .6.5L14 2" /></svg>
)

/* ---------- review ---------- */
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
    <form className="cr-card cr-review" onSubmit={submit}>
      <h2>{t('chat.rateTitle')}</h2>
      <div className="cr-rate" role="radiogroup" aria-label={t('chat.stars')}>
        {[1, 2, 3, 4, 5].map(n => (
          <button type="button" key={n} role="radio" aria-checked={rating === n} aria-label={t('chat.star1', { n })} className={n <= rating ? 'on' : ''} onClick={() => setRating(n)}>★</button>
        ))}
      </div>
      <div className="cr-field"><label htmlFor="rv">{t('chat.comment')}</label><textarea id="rv" rows={3} maxLength={500} value={comment} onChange={e => setComment(e.target.value)} /></div>
      {rating > 0 && rating <= 2 && <p className="notice">{t('chat.lowNote')}</p>}
      {err && <p className="alert" role="alert">{err}</p>}
      <div className="row"><button className="btn btn-gold" disabled={busy}>{busy ? t('chat.saving') : t('chat.submitReview')}</button></div>
    </form>
  )
}

/* ---------- report ---------- */
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
  return (
    <details className="cr-report">
      <summary>⚑ {t('chat.reportTitle')}</summary>
      <form onSubmit={submit}>
        <p className="muted small">{t('chat.reportIntro')}</p>
        <label className="cr-field" htmlFor="report-reason">{t('chat.reportReason')}
          <select id="report-reason" value={reason} onChange={e => setReason(e.target.value as typeof reason)}>
            {(['harassment', 'abuse', 'spam', 'inappropriate', 'other'] as const).map(v => <option key={v} value={v}>{t(`chat.report.${v}`)}</option>)}
          </select>
        </label>
        <label className="cr-field" htmlFor="report-details">{t('chat.reportDetails')}
          <textarea id="report-details" rows={3} minLength={10} maxLength={1200} required value={details} onChange={e => setDetails(e.target.value)} />
        </label>
        {err && <p className="alert" role="alert">{err}</p>}
        <button className="btn btn-line" disabled={busy || details.trim().length < 10}>{busy ? t('chat.saving') : t('chat.reportSubmit')}</button>
      </form>
    </details>
  )
}

/* ---------- page ---------- */
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
  const [info, setInfo] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const typingOff = useRef<ReturnType<typeof setTimeout>>()
  const typingOn = useRef(false)

  const live = s?.status === 'requested' || s?.status === 'active'
  const now = useNow(live)
  const role = s?.viewerRole
  const status = s?.status
  const errText = (e: unknown): string => (isApiError(e) ? e.message : t('chat.err'))

  useEffect(() => {
    if (role !== 'user') return
    api<{ balancePaise: number }>('/sessions/status').then(r => setBal0(r.balancePaise)).catch(() => {})
  }, [role, status])

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [c.messages.length, c.typing])

  const { markRead } = c
  useEffect(() => {
    if (!role) return
    const unread = c.messages.some(m => m.senderRole !== 'system' && m.senderRole !== role && !m.read)
    if (unread && document.visibilityState === 'visible') markRead()
  }, [c.messages, role, markRead])

  useEffect(() => () => clearTimeout(typingOff.current), [])

  // Close the info drawer with Escape.
  useEffect(() => {
    if (!info) return
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') setInfo(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [info])

  function resize() {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 140) + 'px'
  }

  function onType(v: string) {
    setText(v)
    requestAnimationFrame(resize)
    if (!typingOn.current) { typingOn.current = true; c.setTypingOn(true) }
    clearTimeout(typingOff.current)
    typingOff.current = setTimeout(() => { typingOn.current = false; c.setTypingOn(false) }, 2000)
  }

  async function submit(e?: FormEvent) {
    e?.preventDefault()
    const body = text.trim()
    if (!body || sending) return
    setSending(true); setSendErr('')
    try {
      await c.send(body)
      setText('')
      requestAnimationFrame(resize)
      clearTimeout(typingOff.current)
      if (typingOn.current) { typingOn.current = false; c.setTypingOn(false) }
      inputRef.current?.focus()
    } catch (x) { setSendErr((x as Error).message) } finally { setSending(false) }
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void submit() }
  }

  async function act(path: 'end' | 'cancel' | 'accept' | 'reject') {
    setActErr('')
    try { c.setSession((await api<{ session: SessionView }>(`/sessions/${id}/${path}`, { method: 'POST' })).session) }
    catch (x) { setActErr(errText(x)) }
  }
  const endChat = () => { if (window.confirm(t('chat.endConfirm'))) void act('end') }

  /* ----- loading / error ----- */
  if (c.error && !s) {
    return (
      <section className="cr cr-center">
        <div className="cr-card cr-statebox">
          <h1>{t('chat.title')}</h1>
          <p className="alert" role="alert">{c.error}</p>
          <Link className="btn btn-gold" to="/order-history">{t('chat.backChats')}</Link>
        </div>
      </section>
    )
  }
  if (!s) {
    return (
      <section className="cr cr-center">
        <div className="cr-loading"><span className="cr-orb" /><p>{c.connected ? t('chat.opening') : t('chat.connecting')}</p></div>
      </section>
    )
  }

  /* ----- derived values (same logic as before) ----- */
  const isUser = s.viewerRole === 'user'
  const other = isUser ? s.astrologer.displayName : s.birth.name
  const initial = other.trim().charAt(0).toUpperCase()
  const startedMs = s.startedAt ? Date.parse(s.startedAt) : 0
  const elapsed = s.status === 'active' ? (now - startedMs) / 1000 : s.durationSeconds
  const billed = Math.max(c.billedMinutes ?? 0, s.billedMinutes)
  const charged = s.isFree ? 0 : Math.max(billed * s.pricePerMinPaise, s.amountChargedPaise ?? 0)
  const balance = c.balancePaise ?? bal0
  const nextCharge = (startedMs + billed * 60_000 - now) / 1000
  const freeLeft = s.paidUntil ? (Date.parse(s.paidUntil) - now) / 1000 : 0
  const expiresIn = (Date.parse(s.requestExpiresAt) - now) / 1000
  const reqTotal = Math.max(1, (Date.parse(s.requestExpiresAt) - Date.parse(s.requestedAt)) / 1000)
  const reqPct = Math.min(1, Math.max(0, expiresIn / reqTotal))
  const lastMine = [...c.messages].reverse().find(m => m.senderRole === s.viewerRole)
  const canWrite = s.status === 'active' && c.connected
  const b = s.birth
  const genderText = b.gender === 'male' ? t('chat.male') : b.gender === 'female' ? t('chat.female') : b.gender ? t('chat.other') : ''
  const statusLabel = s.status === 'active' ? t('chat.live') : s.status === 'requested' ? t('chat.waiting') : t('chat.closed')
  const backTo = isUser ? '/order-history' : '/astrologer-panel'
  const backLabel = isUser ? t('chat.orderHistory') : t('chat.backRequests')
  const showLog = s.status === 'active' || s.status === 'ended' || c.messages.length > 0
  const closedView = s.status !== 'requested' && s.status !== 'active'
  const dayKey = (iso: string) => new Date(iso).toDateString()
  const dayLabel = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

  /* ----- pieces ----- */
  const requestCard = (
    <div className="cr-wait">
      <div className="cr-ring">
        <span className="cr-ripple" /><span className="cr-ripple d2" />
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle className="trk" cx="60" cy="60" r="54" />
          <circle className="bar" cx="60" cy="60" r="54" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - reqPct} />
        </svg>
        <div className="cr-avatar xl">{initial}</div>
      </div>
      {isUser ? <>
        <h2>{t('chat.waitingFor', { name: other })}</h2>
        <p className="cr-count">{expiresIn > 0 ? t('chat.closesIn', { time: clock(expiresIn) }) : t('chat.checking')}</p>
        <p className="muted small">{s.isFree ? t('chat.freeNoCharge') : t('chat.billingStarts')}</p>
        <div className="row"><button className="btn btn-line" onClick={() => void act('cancel')}>{t('chat.cancelReq')}</button></div>
      </> : <>
        <h2>{t('chat.wantsChat', { name: b.name })}</h2>
        <p className="cr-count">{t('chat.closesIn', { time: clock(expiresIn) })}</p>
        <div className="row"><button className="btn btn-gold" onClick={() => void act('accept')}>{t('chat.accept')}</button><button className="btn btn-line" onClick={() => void act('reject')}>{t('chat.decline')}</button></div>
      </>}
    </div>
  )

  const endedCard = (
    <div className="cr-card cr-done">
      {s.status === 'ended' ? <>
        <div className="cr-done-ico" aria-hidden="true">✦</div>
        <div className="cr-done-body">
          <h2>{t('chat.ended')}</h2>
          <p>{t('chat.length', { time: clock(s.durationSeconds) })}{' '}
            {isUser
              ? (s.isFree ? t('chat.wasFree') : t('chat.chargedFor', { amount: rupees(s.amountChargedPaise ?? 0), n: s.billedMinutes, unit: t(s.billedMinutes === 1 ? 'chat.minute' : 'chat.minutes') }))
              : t('chat.earning', { amount: rupees(s.astrologerEarningPaise ?? 0) })}
          </p>
          {isUser && s.refundStatus === 'flagged' && <p className="notice">{t('chat.refundFlag')}</p>}
          {isUser && s.refundStatus === 'refunded' && <p className="notice">{t('chat.refunded', { amount: rupees(s.refundedPaise ?? 0) })}</p>}
        </div>
      </> : <>
        <div className="cr-done-ico off" aria-hidden="true">✕</div>
        <div className="cr-done-body">
          <h2>{t('chat.reqClosed')}</h2>
          <p>{STOP_REASONS.includes(s.endReason ?? '') ? t('chat.stop.' + s.endReason) : t('chat.reqClosedDefault')}</p>
        </div>
      </>}
      <div className="row cr-done-act">
        {isUser && <Link className="btn btn-gold" to={`/chat-with/${s.astrologer.slug}`}>{t('chat.again')}</Link>}
        <Link className="btn btn-line" to={backTo}>{backLabel}</Link>
      </div>
    </div>
  )

  const afterChat = (
    <>
      {isUser && s.status === 'ended' && !s.reviewed && !s.astrologer.isDemo && (
        <ReviewBox id={s.id} onDone={() => c.setSession({ ...s, reviewed: true })} />
      )}
      {isUser && s.status === 'ended' && s.reviewed && <p className="cr-thanks">★ {t('chat.thanks')}</p>}
      {(s.status === 'active' || s.status === 'ended') && !s.astrologer.isDemo && (s.reported
        ? <p className="notice" role="status">{t('chat.reported')}</p>
        : <ReportBox id={s.id} onDone={() => c.setSession({ ...s, reported: true })} />)}
    </>
  )

  return (
    <section className="cr">
      <span className="cr-bg" aria-hidden="true" />

      {/* ===== sidebar / drawer ===== */}
      {info && <button className="cr-scrim" aria-label="Close" onClick={() => setInfo(false)} />}
      <aside className={'cr-side' + (info ? ' open' : '')} aria-label={t('chat.birthTitle')}>
        <button className="cr-iconbtn cr-side-close" onClick={() => setInfo(false)} aria-label="Close">{<CloseIcon />}</button>

        <div className="cr-person">
          <div className={'cr-avatar lg' + (s.status === 'active' ? ' live' : '')} aria-hidden="true">{initial}</div>
          <b>{other}</b>
          <span className="cr-role">{isUser ? 'Astrologer' : 'Client'}</span>
          <span className={'cr-pill ' + s.status}><i />{statusLabel}</span>
        </div>

        <div className="cr-card cr-birth">
          <h2>{t('chat.birthTitle')}</h2>
          <dl className="cr-kv">
            <div><dt>{t('chat.name')}</dt><dd>{b.name}</dd></div>
            {genderText && <div><dt>{t('chat.gender')}</dt><dd>{genderText}</dd></div>}
            <div><dt>{t('chat.dob')}</dt><dd>{b.birthDate}</dd></div>
            <div><dt>{t('chat.tob')}</dt><dd>{b.birthTime ?? t('chat.unknown')}</dd></div>
            <div className="wide"><dt>{t('chat.pob')}</dt><dd>{b.birthPlace}</dd></div>
          </dl>
        </div>

        <KundliQuick birth={b} />
        <p className="cr-disc">{t('chat.disclaimer')}</p>
      </aside>

      {/* ===== main ===== */}
      <div className="cr-main">
        <header className="cr-head">
          <Link className="cr-iconbtn" to={backTo} aria-label={backLabel}><BackIcon /></Link>
          <div className={'cr-avatar' + (s.status === 'active' ? ' live' : '')} aria-hidden="true">{initial}</div>
          <div className="cr-title">
            <h1>{t('chat.with', { name: other })}</h1>
            <span className={'cr-sub ' + s.status}>
              <i />{c.typing && s.status === 'active' ? t('chat.typing', { name: other }) : statusLabel}
            </span>
          </div>
          {s.status === 'active' && <button className="btn btn-line sm cr-end" onClick={endChat}>{t('chat.end')}</button>}
          <button className="cr-iconbtn cr-info" onClick={() => setInfo(true)} aria-label={t('chat.birthTitle')}><InfoIcon /></button>
        </header>

        {s.status === 'active' && (
          <div className="cr-bar" role="status">
            {s.isFree
              ? <span className="cr-chip gold"><b>{t('chat.freeChat')}</b> · {t('chat.left', { time: clock(freeLeft) })}</span>
              : <span className="cr-chip gold"><b>{clock(elapsed)}</b> · {t('chat.perMin', { price: rupees(s.pricePerMinPaise) })}</span>}
            {isUser && !s.isFree && <span className="cr-chip">{t('chat.charged', { amount: rupees(charged), time: clock(nextCharge) })}</span>}
            {isUser && balance !== null && <span className="cr-chip">{t('chat.wallet', { amount: rupees(balance) })}</span>}
          </div>
        )}

        {(s.astrologer.isDemo || (live && !c.connected) || actErr || (isUser && c.low && s.status === 'active')) && (
          <div className="cr-alerts">
            {s.astrologer.isDemo && <p className="notice">{t('chat.demo')}</p>}
            {live && !c.connected && <p className="alert" role="status">{t('chat.reconnecting')}</p>}
            {actErr && <p className="alert" role="alert">{actErr}</p>}
            {isUser && c.low && s.status === 'active' && (
              <p className="notice" role="alert">{t('chat.lowBalance')} <Link to="/my-wallet" target="_blank" rel="noopener">{t('chat.addMoney')}</Link> {t('chat.newTab')}</p>
            )}
          </div>
        )}

        {/* stage */}
        {s.status === 'requested' ? (
          <div className="cr-stage cr-stage-center">{requestCard}</div>
        ) : !showLog ? (
          <div className="cr-stage cr-stage-center">{endedCard}</div>
        ) : (
          <div className="cr-log" ref={listRef} role="log" aria-live="polite" aria-label={t('chat.messages')}>
            {c.messages.length === 0 && (
              <div className="cr-empty"><span aria-hidden="true">✦</span><p>{t('chat.noMessages')}</p></div>
            )}
            {c.messages.map((m, i) => {
              const prev = c.messages[i - 1]
              const next = c.messages[i + 1]
              const newDay = !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt)
              const day = newDay ? <div className="cr-day"><span>{dayLabel(m.createdAt)}</span></div> : null
              if (m.senderRole === 'system') return <div key={m.id} className="cr-fragment">{day}<p className="cr-sys">{m.body}</p></div>
              const mine = m.senderRole === s.viewerRole
              const first = newDay || !prev || prev.senderRole !== m.senderRole
              const last = !next || next.senderRole !== m.senderRole || dayKey(next.createdAt) !== dayKey(m.createdAt)
              return (
                <div key={m.id} className="cr-fragment">
                  {day}
                  <div className={'cr-msg ' + (mine ? 'mine' : 'theirs') + (first ? ' first' : '') + (last ? ' last' : '')}>
                    <p>{m.body}</p>
                    <span className="cr-meta">
                      {new Date(m.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      {mine && <Ticks seen={!!m.read} />}
                      {lastMine?.id === m.id && m.read && <em>{t('chat.seen')}</em>}
                    </span>
                  </div>
                </div>
              )
            })}
            {c.typing && (
              <div className="cr-msg theirs first last cr-typing" aria-label={t('chat.typing', { name: other })}>
                <i /><i /><i />
              </div>
            )}
          </div>
        )}

        {/* footer */}
        {s.status === 'active' && (
          <div className="cr-compose">
            {sendErr && <p className="alert" role="alert">{sendErr}</p>}
            <form onSubmit={submit}>
              <label htmlFor="msg" className="sr">{t('chat.message')}</label>
              <textarea
                id="msg" ref={inputRef} rows={1} value={text} maxLength={2000} autoComplete="off"
                placeholder={canWrite ? t('chat.placeholder') : t('chat.waitConn')} disabled={!canWrite}
                onChange={e => onType(e.target.value)} onKeyDown={onKey}
              />
              <button className="cr-send" disabled={!canWrite || sending || !text.trim()} aria-label={t('chat.send')}><SendIcon /></button>
            </form>
            <p className="cr-disc small-only">{t('chat.disclaimer')}</p>
          </div>
        )}

        {closedView && showLog && (
          <div className="cr-foot">
            {endedCard}
            {afterChat}
          </div>
        )}
        {s.status === 'active' && !s.astrologer.isDemo && (
          <div className="cr-foot slim">{afterChat}</div>
        )}
      </div>
    </section>
  )
}