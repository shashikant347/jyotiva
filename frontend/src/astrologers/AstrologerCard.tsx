import { Link } from 'react-router-dom'
import { usePrefs } from '../context/PrefsContext'
import { portraitSvg } from './portrait'
import { rupees, type Astro, type Meta } from './types'

const STATUS = { online: 'Online now', busy: 'In a chat', offline: 'Offline' } as const

export function Portrait({ a, size = 64 }: { a: Pick<Astro, 'slug' | 'gender' | 'displayName' | 'photoUrl'>; size?: number }) {
  if (a.photoUrl) return <span className="portrait" style={{ width: size, height: size }}><img src={a.photoUrl} alt={a.displayName} loading="lazy" /></span>
  // portraitSvg only emits fixed palettes and hash numbers, so injecting it is safe.
  return <span className="portrait" style={{ width: size, height: size }} role="img" aria-label={a.displayName} dangerouslySetInnerHTML={{ __html: portraitSvg(a.slug, a.gender) }} />
}

export function TrendingTile({ a, mode }: { a: Astro; mode: 'chat' | 'call' }) {
  const price = mode === 'call' ? a.callPricePaise : a.chatPricePaise
  return (
    <article className="ttile">
      <Link to={`/best-astrologer/${a.slug}`} className="ttile-link"><Portrait a={a} size={76} /><b>{a.displayName}</b></Link>
      <span className="ttile-price">{rupees(price)}<small>/ min</small></span>
      <Link className="btn-out ghost" to={`/best-astrologer/${a.slug}`}>View profile</Link>
    </article>
  )
}

export default function AstrologerCard({ a, meta, mode }: { a: Astro; meta: Meta | null; mode: 'chat' | 'call' }) {
  const { t } = usePrefs()
  const name = (list: { slug?: string; code?: string; name: string }[] | undefined, key: string) => list?.find(item => (item.slug ?? item.code) === key)?.name ?? key
  const price = mode === 'call' ? a.callPricePaise : a.chatPricePaise
  const skills = a.skills.slice(0, 3).map(skill => name(meta?.skills, skill))
  const specialties = a.categories.slice(0, 3).map(category => name(meta?.categories, category))

  return (
    <article className="acard">
      <div className="astro-card-head">
        <span className={`ring ${a.status}`}><Portrait a={a} size={72} /><i className="dot" aria-label={STATUS[a.status]} /></span>
        <div className="astro-card-identity">
          <span className={`astro-card-status ${a.status}`}><i aria-hidden="true" />{STATUS[a.status]}</span>
          <h3><Link to={`/best-astrologer/${a.slug}`}>{a.displayName}</Link>{!a.isDemo && <span className="vtick" title="Identity checked by Jyotiva" aria-label="Verified">✓</span>}</h3>
          <p className="aexp">{a.experienceYears} years of experience</p>
        </div>
        {a.badge && <span className="astro-card-badge">{a.badge}</span>}
      </div>

      <div className="astro-card-tags">
        {specialties.map(item => <span className="astro-specialty" key={item}>{item}</span>)}
      </div>
      <div className="skill-chips">{skills.map(item => <span key={item}>{item}</span>)}</div>
      <p className="alang"><span className="muted">Speaks</span> {a.languages.map(language => name(meta?.languages, language)).join(', ')}</p>
      {a.isDemo && <p className="demo-tag">Demo profile · not a real astrologer</p>}

      <div className="acard-foot">
        <span className="arate">{a.ratingAvg !== null ? <><b>★ {a.ratingAvg.toFixed(1)}</b> <span className="muted">({a.ratingCount})</span></> : <span className="muted">New profile</span>}</span>
        <b className="aprice">{rupees(price)}<span>/ min</span></b>
      </div>
      <div className="acard-btns">
        {mode === 'call'
          ? <button className="btn-out" disabled title={t('card.callTip')}>{t('card.callSoon')}</button>
          : a.status === 'online'
            ? <Link className="btn-out solid" to={`/chat-with/${a.slug}`}>{t('card.chat')}</Link>
            : <button className="btn-out" disabled title={t(a.status === 'busy' ? 'card.busyTip' : 'card.offlineTip')}>{t(a.status === 'busy' ? 'card.busy' : 'card.offline')}</button>}
        <Link className="btn-out ghost" to={`/best-astrologer/${a.slug}`}>View profile</Link>
      </div>
    </article>
  )
}
