import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AstrologerCard, { Portrait } from '../astrologers/AstrologerCard'
import { rupees, type Astro, type Meta } from '../astrologers/types'
import { usePageMeta } from '../hooks'
import { api, isApiError } from '../services/api'
import NotFound from './NotFound'

interface Review { rating: number; comment: string; astrologerReply: string | null; createdAt: string }
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function AstrologerProfile() {
  const { slug = '' } = useParams()
  const { user } = useAuth()
  const [a, setA] = useState<Astro | null>(null)
  const [similar, setSimilar] = useState<Astro[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [meta, setMeta] = useState<Meta | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'missing' | 'error'>('loading')
  const [watch, setWatch] = useState<{ active: boolean } | null>(null)
  const [watchReady, setWatchReady] = useState(false)
  const [watchBusy, setWatchBusy] = useState(false)
  const [watchMsg, setWatchMsg] = useState('')
  usePageMeta(a ? `${a.displayName}, astrologer` : '', { noindex: !!a?.isDemo, description: a?.bio.slice(0, 150) })

  useEffect(() => {
    let live = true
    setState('loading')
    api<{ astrologer: Astro; similar: Astro[] }>(`/astrologers/${slug}`, { auth: false })
      .then(r => { if (live) { setA(r.astrologer); setSimilar(r.similar); setState('ok') } })
      .catch(e => { if (live) setState(isApiError(e) && e.status === 404 ? 'missing' : 'error') })
    api<{ items: Review[] }>(`/astrologers/${slug}/reviews`, { auth: false }).then(r => { if (live) setReviews(r.items) }).catch(() => {})
    api<Meta>('/astrologers/categories', { auth: false }).then(m => { if (live) setMeta(m) }).catch(() => {})
    return () => { live = false }
  }, [slug])

  useEffect(() => {
    if (!user || !a || a.status === 'online') { setWatch(null); setWatchReady(true); return }
    let live = true
    setWatchReady(false)
    api<{ watch: { active: boolean } | null }>(`/astrologers/${encodeURIComponent(slug)}/availability-watch`)
      .then(r => { if (live) { setWatch(r.watch); setWatchReady(true) } })
      .catch(() => { if (live) setWatchReady(true) })
    return () => { live = false }
  }, [slug, user, a?.status])

  async function toggleWatch() {
    if (!user || !a) return
    setWatchBusy(true); setWatchMsg('')
    try {
      if (watch?.active) {
        await api(`/astrologers/${encodeURIComponent(slug)}/availability-watch`, { method: 'DELETE' })
        setWatch(null); setWatchMsg('Availability alert cancelled.')
      } else {
        const r = await api<{ watch: { active: boolean } }>(`/astrologers/${encodeURIComponent(slug)}/availability-watch`, { method: 'POST', body: {} })
        setWatch(r.watch); setWatchMsg('We will notify you when this astrologer is available.')
      }
    } catch (e) {
      if (isApiError(e) && e.code === 'ALREADY_AVAILABLE') {
        const r = await api<{ astrologer: Astro }>(`/astrologers/${encodeURIComponent(slug)}`, { auth: false }).catch(() => null)
        if (r) setA(r.astrologer)
        setWatchMsg('This astrologer is available now. Start a chat from the profile.')
      } else setWatchMsg(isApiError(e) ? e.message : 'Could not update the availability alert.')
    } finally { setWatchBusy(false) }
  }

  if (state === 'missing') return <NotFound />
  if (state === 'loading') return <section className="wrap sec"><p className="muted">Loading profile…</p></section>
  if (state === 'error' || !a) return <section className="wrap sec"><p className="alert" role="alert">Could not load this profile. Please try again.</p></section>

  const nameFor = (list: { slug?: string; code?: string; name: string }[] | undefined, key: string) => list?.find(item => (item.slug ?? item.code) === key)?.name ?? key
  const specialties = a.categories.map(item => nameFor(meta?.categories, item))
  const skills = a.skills.map(item => nameFor(meta?.skills, item))
  const languages = a.languages.map(item => nameFor(meta?.languages, item))
  const availability = a.availability?.weekly ?? []
  const statusLabel = a.status === 'online' ? 'Online now' : a.status === 'busy' ? 'In a consultation' : 'Currently offline'

  return (
    <section className="wrap sec astro-profile">
      <Link className="profile-back" to="/chat-with-astrologer"><span aria-hidden="true">←</span> All astrologers</Link>
      <div className="profile-layout">
        <div className="profile-main">
          <section className="panel profile-hero">
            <div className="profile-heading">
              <div className="profile-portrait"><Portrait a={a} size={124} /></div>
              <div className="profile-intro">
                <div className="profile-badges">
                  <span className={`profile-status ${a.status}`}><i aria-hidden="true" />{statusLabel}</span>
                  {a.badge && <span className="profile-highlight">{a.badge}</span>}
                  {a.isDemo && <span className="profile-demo">Demo profile</span>}
                </div>
                <h1 className="page-h">{a.displayName}</h1>
                <p className="profile-subtitle">{specialties.slice(0, 3).join(' · ') || 'Astrology guidance'}</p>
                <div className="profile-rating"><span aria-hidden="true">★</span><b>{a.ratingAvg !== null ? a.ratingAvg.toFixed(1) : 'New'}</b><span className="muted">{a.ratingCount} review{a.ratingCount === 1 ? '' : 's'}</span></div>
              </div>
            </div>
            {a.isDemo && <p className="profile-demo-note">Preview profile only. This is not a real astrologer. Chat replies are automated demo content.</p>}
            <p className="profile-bio">{a.bio}</p>
            <div className="profile-stats">
              <div><span>Experience</span><b>{a.experienceYears} years</b></div>
              <div><span>Languages</span><b>{languages.join(', ') || 'Not listed'}</b></div>
              <div><span>Consultation</span><b>Chat guidance</b></div>
            </div>
          </section>

          <section className="panel profile-details">
            <div className="profile-section-title"><div><span className="profile-kicker">SPECIALTIES</span><h2>Areas of guidance</h2></div><span className="profile-title-icon" aria-hidden="true">✦</span></div>
            <div className="profile-chip-list">{specialties.map(item => <span className="profile-chip" key={item}>{item}</span>)}</div>
            {skills.length > 0 && <div className="profile-skill-block"><h3>Methods</h3><div className="profile-chip-list subtle">{skills.map(item => <span className="profile-chip" key={item}>{item}</span>)}</div></div>}
          </section>

          <section className="panel profile-reviews">
            <div className="profile-section-title"><div><span className="profile-kicker">CLIENT FEEDBACK</span><h2>Reviews</h2></div><span className="profile-review-summary">★ {a.ratingAvg !== null ? a.ratingAvg.toFixed(1) : '—'} <span className="muted">({a.ratingCount})</span></span></div>
            {reviews.length === 0 ? <p className="muted">No reviews yet. Reviews can be shared after a completed consultation.</p>
              : <div className="profile-review-list">{reviews.map((review, index) => (
                <article key={`${review.createdAt}-${index}`} className="profile-review">
                  <div className="profile-review-head"><b aria-label={`${review.rating} out of 5`}>{'★'.repeat(review.rating)}<span>{'☆'.repeat(5 - review.rating)}</span></b><time className="muted small" dateTime={review.createdAt}>{new Date(review.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</time></div>
                  <p>{review.comment}</p>
                  {review.astrologerReply && <div className="profile-reply"><b>Reply from {a.displayName}</b><p>{review.astrologerReply}</p></div>}
                </article>
              ))}</div>}
          </section>

          {similar.length > 0 && <section className="profile-similar"><div className="profile-section-title"><div><span className="profile-kicker">KEEP EXPLORING</span><h2>Similar astrologers</h2></div></div><div className="agrid">{similar.map(item => <AstrologerCard key={item.slug} a={item} meta={meta} mode="chat" />)}</div></section>}
        </div>

        <aside className="profile-aside">
          <section className="panel profile-booking">
            <span className="profile-kicker">CHAT CONSULTATION</span>
            <p className="profile-price">{rupees(a.chatPricePaise)} <span>/ minute</span></p>
            <p className="muted small">You’ll see the estimated cost before starting.</p>
            {a.status === 'online' ? <Link className="btn btn-gold profile-primary-action" to={`/chat-with/${a.slug}`}>Start a chat <span aria-hidden="true">→</span></Link>
              : <button className="btn btn-gold profile-primary-action" disabled>{a.status === 'busy' ? 'Busy in another chat' : 'Currently offline'}</button>}
            {a.status !== 'online' && (user
              ? <button className="btn btn-line profile-secondary-action" disabled={!watchReady || watchBusy} onClick={toggleWatch}>{watch?.active ? 'Cancel availability alert' : 'Notify me when available'}</button>
              : <Link className="btn btn-line profile-secondary-action" to="/login" state={{ from: `/best-astrologer/${a.slug}` }}>Sign in for an availability alert</Link>)}
            {watchMsg && <p className="muted small" role="status">{watchMsg}</p>}
            <div className="profile-assurance"><span aria-hidden="true">✓</span> Private, one-to-one chat</div>
            <div className="profile-assurance"><span aria-hidden="true">✓</span> Astrology for reflection and guidance</div>
          </section>

          <section className="panel profile-hours">
            <div className="profile-section-title"><div><span className="profile-kicker">AVAILABILITY</span><h2>Usual hours</h2></div></div>
            {availability.length ? <><ul>{availability.map((slot, index) => <li key={`${slot.day}-${slot.start}-${index}`}><span>{DAYS[slot.day]}</span><b>{slot.start}–{slot.end}</b></li>)}</ul><p className="muted small">Times shown in {a.availability?.timezone ?? 'local timezone'}.</p></>
              : <p className="muted">Schedule not provided.</p>}
          </section>
          <p className="profile-call-note">Voice calls are not available yet.</p>
        </aside>
      </div>
    </section>
  )
}
