import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { openSocket } from '../chat/socket'
import type { SessionView } from '../chat/types'
import { clock, useNow } from '../chat/useChat'
import { usePrefs } from '../context/PrefsContext'
import { rupees, type Astro } from '../astrologers/types'
import { Portrait } from '../astrologers/AstrologerCard'
import { usePageMeta } from '../hooks'
import AstrologerPayouts from './AstrologerPayouts'
import { api, isApiError, uploadImage } from '../services/api'

type Mine = Astro & { applicationStatus: 'pending' | 'approved' | 'rejected' | 'suspended' }
type Availability = { timezone: string; weekly: { day: number; start: string; end: string }[] }
type Pricing = { chatPriceRupees: number; callPriceRupees: number }
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const TEXT: Record<Mine['applicationStatus'], string> = {
  pending: 'Under review. We will update this page when a decision is made.',
  approved: 'Approved. Your profile is public.',
  rejected: 'Not approved. You can edit your details and apply again.',
  suspended: 'Suspended. Please contact support.',
}

/** A short two-tone beep. Browsers may block audio until the person has clicked on the page; then it stays silent. */
function beep(): void {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx(), osc = ctx.createOscillator(), gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    gain.gain.value = 0.08
    osc.frequency.setValueAtTime(660, ctx.currentTime); osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15)
    osc.start(); osc.stop(ctx.currentTime + 0.35)
    osc.onended = () => { void ctx.close() }
  } catch { /* audio not available */ }
}

/** Chat requests for an approved astrologer: live over the socket, with the list loaded first. */
function Requests({ online }: { online: boolean }) {
  const { t } = usePrefs()
  const nav = useNavigate()
  const [items, setItems] = useState<SessionView[] | null>(null)
  const [err, setErr] = useState('')
  const now = useNow(true)

  useEffect(() => {
    let live = true
    api<{ items: SessionView[] }>('/sessions/incoming').then(r => { if (live) setItems(r.items) }).catch(e => { if (live) { setItems([]); setErr(isApiError(e) ? e.message : t('pr.loadFail')) } })
    const socket = openSocket()
    const upsert = (v: SessionView) => setItems(prev => {
      const list = prev ?? []
      return list.some(x => x.id === v.id) ? list.map(x => (x.id === v.id ? v : x)) : [v, ...list]
    })
    socket.on('session:requested', (v: SessionView) => { upsert(v); beep() })
    socket.on('session:update', upsert)
    return () => { live = false; socket.disconnect() }
  }, [])

  async function act(id: string, path: 'accept' | 'reject') {
    setErr('')
    try {
      await api(`/sessions/${id}/${path}`, { method: 'POST' })
      if (path === 'accept') nav(`/chat/${id}`)
    } catch (e) { setErr(isApiError(e) ? e.message : 'Something went wrong') }
  }

  const waiting = (items ?? []).filter(x => x.status === 'requested' && Date.parse(x.requestExpiresAt) > now)
  const waitingCount = waiting.length
  // Show the number of waiting requests in the browser tab title, so it is noticed from another tab.
  useEffect(() => {
    if (waitingCount === 0) return
    const base = document.title
    document.title = `(${waitingCount}) ${base}`
    return () => { document.title = base }
  }, [waitingCount])
  const live = (items ?? []).find(x => x.status === 'active')
  const past = (items ?? []).filter(x => x.status !== 'requested' && x.status !== 'active')
  return (
    <div className="panel astro-requests">
      <div className="astro-section-head">
        <div><p className="astro-kicker">YOUR INBOX</p><h2>{t('pr.title')}</h2></div>
        <span className={'astro-status ' + (online ? 'online' : 'offline')}><i />{online ? 'Online' : 'Offline'}</span>
      </div>
      <p className="muted small">{t(online ? 'pr.hintOn' : 'pr.hintOff')}</p>
      {err && <p className="alert" role="alert">{err}</p>}
      {live && <p className="notice">{t('pr.inChat', { name: live.birth.name })} <Link to={`/chat/${live.id}`}>{t('pr.openChat')}</Link></p>}
      {waiting.map(r => (
        <div key={r.id} className="req">
          <p><b>{r.birth.name}</b>{r.isFree ? ` · ${t('pr.freeTag')}` : ` · ${t('chat.perMin', { price: rupees(r.pricePerMinPaise) })}`}<br /><span className="muted small">{t('pr.born', { date: r.birth.birthDate, time: r.birth.birthTime ? ` ${r.birth.birthTime}` : '', place: r.birth.birthPlace, left: clock((Date.parse(r.requestExpiresAt) - now) / 1000) })}</span></p>
          {r.isFree && <p className="muted small">{t('pr.freeNote')}</p>}
          <div className="row"><button className="btn btn-gold sm" onClick={() => void act(r.id, 'accept')}>{t('chat.accept')}</button><button className="btn btn-line sm" onClick={() => void act(r.id, 'reject')}>{t('chat.decline')}</button></div>
        </div>
      ))}
      {items === null && <p className="muted">Loading incoming requests…</p>}
      {items !== null && waiting.length === 0 && !live && <p className="empty">{t('pr.none')}</p>}
      {past.length > 0 && <>
        <h3>{t('pr.recent')}</h3>
        <table className="tbl"><thead><tr><th>{t('pr.date')}</th><th>{t('pr.client')}</th><th>{t('pr.status')}</th><th>{t('pr.length')}</th><th>{t('pr.earning')}</th></tr></thead><tbody>
          {past.slice(0, 15).map(r => (
            <tr key={r.id}>
              <td>{new Date(r.requestedAt).toLocaleDateString('en-IN')}</td>
              <td>{r.status === 'ended' ? <Link to={`/chat/${r.id}`}>{r.birth.name}</Link> : r.birth.name}</td>
              <td>{t('pr.s.' + r.status)}</td>
              <td>{r.status === 'ended' ? clock(r.durationSeconds) : '-'}</td>
              <td>{r.status === 'ended' ? rupees(r.astrologerEarningPaise ?? 0) : '-'}</td>
            </tr>
          ))}
        </tbody></table>
      </>}
    </div>
  )
}

export default function AstrologerPanel() {
  usePageMeta('Astrologer page', { noindex: true })
  const [a, setA] = useState<Mine | null | undefined>(undefined)
  const [msg, setMsg] = useState('')
  const [availability, setAvailability] = useState<Availability>({ timezone: 'Asia/Kolkata', weekly: [] })
  const [availabilityMsg, setAvailabilityMsg] = useState('')
  const [pricing, setPricing] = useState<Pricing>({ chatPriceRupees: 5, callPriceRupees: 5 })
  const [pricingMsg, setPricingMsg] = useState('')
  const [photoMsg, setPhotoMsg] = useState('')
  const [photoBusy, setPhotoBusy] = useState(false)
  useEffect(() => { api<{ application: Mine | null }>('/astrologers/me/profile').then(r => {
    setA(r.application)
    setAvailability(r.application?.availability ?? { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata', weekly: [] })
    if (r.application) setPricing({ chatPriceRupees: r.application.chatPricePaise / 100, callPriceRupees: r.application.callPricePaise / 100 })
  }).catch(e => { setA(null); setMsg(isApiError(e) ? e.message : 'Something went wrong') }) }, [])

  async function toggleOnline() {
    if (!a) return
    try { setA((await api<{ application: Mine }>('/astrologers/me/status', { method: 'PATCH', body: { isOnline: a.status === 'offline' } })).application); setMsg('') }
    catch (e) { setMsg(isApiError(e) ? e.message : 'Something went wrong') }
  }

  async function saveAvailability(e: FormEvent) {
    e.preventDefault(); setAvailabilityMsg('Saving...')
    try {
      const r = await api<{ application: Mine }>('/astrologers/me/availability', { method: 'PATCH', body: availability })
      setA(r.application); setAvailability(r.application.availability ?? availability); setAvailabilityMsg('Weekly hours saved.')
    } catch (err) { setAvailabilityMsg(isApiError(err) ? err.message : 'Could not save weekly hours.') }
  }

  async function savePricing(e: FormEvent) {
    e.preventDefault(); setPricingMsg('Saving...')
    try {
      const r = await api<{ application: Mine }>('/astrologers/me/pricing', { method: 'PATCH', body: pricing })
      setA(r.application); setPricingMsg('Prices updated for new chat requests.')
    } catch (err) { setPricingMsg(isApiError(err) ? err.message : 'Could not update prices.') }
  }

  async function updatePhoto(file: File | undefined) {
    if (!file || !a) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setPhotoMsg('Choose a JPEG, PNG or WebP image up to 5 MB.')
      return
    }
    setPhotoBusy(true); setPhotoMsg('Uploading...')
    try {
      const r = await uploadImage<{ application: Mine }>('/astrologers/me/photo', file)
      setA(r.application); setPhotoMsg('Profile photo updated.')
    } catch (e) { setPhotoMsg(isApiError(e) ? e.message : 'Could not upload the photo.') }
    finally { setPhotoBusy(false) }
  }

  function updateDay(day: number, enabled: boolean) {
    setAvailability(v => ({ ...v, weekly: enabled
      ? [...v.weekly, { day, start: '09:00', end: '17:00' }].sort((x, y) => x.day - y.day)
      : v.weekly.filter(s => s.day !== day) }))
  }

  if (a === undefined) return <section className="wrap sec astro-dashboard"><p className="muted">Loading your studio…</p></section>
  if (!a) return <section className="wrap sec astro-dashboard">
    <div className="astro-welcome astro-welcome-apply">
      <div><p className="astro-kicker">Jyotiva · Astrologer studio</p><h1>Begin your astrologer journey</h1><p className="lead">Create your profile to connect with people looking for trusted guidance.</p>
        {msg && <p className="alert" role="alert">{msg}</p>}
        <Link className="btn btn-gold" to="/astrologer-signup">Apply to become an astrologer</Link>
      </div>
      <div className="astro-orbit" aria-hidden="true"><span>✦</span><i>☾</i><b>ॐ</b></div>
    </div>
  </section>
  return (
    <section className="wrap sec settings astro-dashboard">
      <div className="astro-welcome">
        <div className="astro-welcome-copy">
          <p className="astro-kicker">JYOTIVA · ASTROLOGER STUDIO</p>
          <h1>Welcome back, {a.displayName}</h1>
          <p>One place to manage your presence, consultations, and client requests.</p>
          {msg && <p className="alert" role="alert">{msg}</p>}
          {a.applicationStatus === 'approved' && <div className="row astro-hero-actions">
            <button className="btn btn-gold" onClick={toggleOnline}>{a.status === 'offline' ? 'Go online' : 'Go offline'}</button>
            <Link className="btn astro-profile-button" to={`/best-astrologer/${a.slug}`}>View public profile <span aria-hidden="true">↗</span></Link>
          </div>}
        </div>
        <div className="astro-hero-profile">
          {a.applicationStatus === 'approved' ? <Portrait a={a} size={88} /> : <div className="astro-avatar-placeholder" aria-hidden="true">{a.displayName.charAt(0).toUpperCase()}</div>}
          <div className="astro-profile-meta">
            <b>{a.displayName}</b>
            <span className={'astro-status ' + (a.applicationStatus === 'approved' ? a.status : a.applicationStatus)}><i />{a.applicationStatus === 'approved' ? (a.status === 'busy' ? 'In a chat' : a.status) : a.applicationStatus}</span>
          </div>
          {a.applicationStatus === 'approved' && <label className="field astro-photo-field">Update profile photo
            <input type="file" accept="image/jpeg,image/png,image/webp" disabled={photoBusy} onChange={e => { void updatePhoto(e.target.files?.[0]); e.currentTarget.value = '' }} />
              <small>JPEG, PNG or WebP · up to 5 MB</small>
          </label>}
          {photoMsg && <p className="muted small" role="status">{photoMsg}</p>}
        </div>
      </div>

      {a.applicationStatus !== 'approved' ? <div className="panel astro-application-card">
        <span className={'astro-status ' + a.applicationStatus}><i />Application {a.applicationStatus}</span>
        <h2>{a.applicationStatus === 'pending' ? 'Your profile is being reviewed' : a.applicationStatus === 'rejected' ? 'Your application needs an update' : 'Your profile is currently paused'}</h2>
        <p className="muted">{TEXT[a.applicationStatus]}</p>
        {a.applicationStatus === 'rejected' && <Link className="btn btn-gold" to="/astrologer-signup">Update and apply again</Link>}
        {a.applicationStatus === 'suspended' && <Link to="/customer-support">Contact support</Link>}
      </div> : <>
        <div className="astro-metrics" aria-label="Astrologer profile overview">
          <article className="astro-metric"><span>EXPERIENCE</span><b>{a.experienceYears} <small>years</small></b><i>✦</i></article>
          <article className="astro-metric"><span>CHAT SESSION</span><b>{rupees(a.chatPricePaise)} <small>/ min</small></b><i>☷</i></article>
          <article className="astro-metric"><span>CALL SESSION</span><b>{rupees(a.callPricePaise)} <small>/ min</small></b><i>◖</i></article>
          <article className="astro-metric"><span>PROFILE STATUS</span><b className={a.status}>{a.status === 'busy' ? 'In a chat' : a.status === 'offline' ? 'Offline' : 'Online'}</b><i>◉</i></article>
        </div>
        <Requests online={a.status !== 'offline'} />
        <div className="astro-settings-grid">
        <form className="panel settings" onSubmit={savePricing}>
          <h2>Consultation prices</h2>
          <p className="muted small">Set your price per minute in rupees. Existing requests and chats keep the rate they started with. Allowed range: ₹5–₹200.</p>
          <div className="form-grid">
            <label className="field" htmlFor="chat-price">Chat price per minute (₹)<input id="chat-price" type="number" min={5} max={200} step={1} value={pricing.chatPriceRupees} required onChange={e => setPricing(v => ({ ...v, chatPriceRupees: Number(e.target.value) }))} /></label>
            <label className="field" htmlFor="call-price">Call price per minute (₹)<input id="call-price" type="number" min={5} max={200} step={1} value={pricing.callPriceRupees} required onChange={e => setPricing(v => ({ ...v, callPriceRupees: Number(e.target.value) }))} /></label>
          </div>
          <button className="btn btn-gold" type="submit">Save prices</button>
          {pricingMsg && <p className="muted" role="status">{pricingMsg}</p>}
        </form>
        <form className="panel settings" onSubmit={saveAvailability}>
          <h2>Weekly availability</h2>
          <p className="muted small">Set the hours you usually accept consultations. This schedule is informational; online/offline status is still controlled separately.</p>
          <div className="field"><label htmlFor="availability-timezone">Timezone</label><input id="availability-timezone" value={availability.timezone} maxLength={64} required onChange={e => setAvailability(v => ({ ...v, timezone: e.target.value }))} /><small>Use an IANA timezone such as Asia/Kolkata.</small></div>
          <div className="form-grid">{DAYS.map((day, i) => {
            const slot = availability.weekly.find(s => s.day === i)
            return <div className="panel" key={day}><label className="check"><input type="checkbox" checked={!!slot} onChange={e => updateDay(i, e.target.checked)} /> {day}</label>
              {slot && <div className="row"><label className="field">From<input type="time" value={slot.start} step={900} required onChange={e => setAvailability(v => ({ ...v, weekly: v.weekly.map(s => s.day === i ? { ...s, start: e.target.value } : s) }))} /></label>
                <label className="field">Until<input type="time" value={slot.end} step={900} required onChange={e => setAvailability(v => ({ ...v, weekly: v.weekly.map(s => s.day === i ? { ...s, end: e.target.value } : s) }))} /></label></div>}
            </div>
          })}</div>
          <button className="btn btn-gold" type="submit">Save weekly hours</button>
          {availabilityMsg && <p className="muted" role="status">{availabilityMsg}</p>}
        </form>
        </div>
        <AstrologerPayouts />
      </>}
    </section>
  )
}
