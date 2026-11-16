import { useEffect, useState } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import AstrologerCard, { TrendingTile } from '../astrologers/AstrologerCard'
import type { Astro, Meta } from '../astrologers/types'
import { usePageMeta } from '../hooks'
import { api, isApiError } from '../services/api'

interface Page { total: number; page: number; limit: number; items: Astro[] }
const PER = 12

export default function Astrologers() {
  const { pathname } = useLocation()
  const { category: catParam } = useParams()
  const mode: 'chat' | 'call' = pathname.startsWith('/talk-to-astrologer') ? 'call' : 'chat'
  const [sp, setSp] = useSearchParams()
  const [meta, setMeta] = useState<Meta | null>(null)
  const [data, setData] = useState<Page | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(true)
  const [q, setQ] = useState(sp.get('q') ?? '')

  const category = catParam ?? sp.get('category') ?? ''
  const catName = meta?.categories.find(c => c.slug === category)?.name
  usePageMeta(catName ? `${catName} astrologers` : mode === 'call' ? 'Talk to an astrologer' : 'Chat with an astrologer', { description: 'Browse astrologers by language, speciality, experience and price.' })

  useEffect(() => { api<Meta>('/astrologers/categories', { auth: false }).then(setMeta).catch(() => {}) }, [])
  const get = (k: string) => sp.get(k) ?? ''
  const set = (k: string, v: string) => { const n = new URLSearchParams(sp); if (v) n.set(k, v); else n.delete(k); if (k !== 'page') n.delete('page'); setSp(n, { replace: true }) }
  useEffect(() => { const t = setTimeout(() => { if (q !== get('q')) set('q', q) }, 350); return () => clearTimeout(t) }, [q]) // eslint-disable-line react-hooks/exhaustive-deps

  const qs = new URLSearchParams({ mode, limit: String(PER), page: get('page') || '1', sort: get('sort') || 'popular' })
  for (const k of ['language', 'gender', 'q', 'online', 'minExperience', 'maxPrice']) if (get(k)) qs.set(k, get(k))
  if (category) qs.set('category', category)
  const key = qs.toString()
  useEffect(() => {
    let live = true
    setBusy(true); setErr('')
    api<Page>('/astrologers?' + key, { auth: false })
      .then(r => { if (live) setData(r) })
      .catch(e => { if (live) { setData(null); setErr(isApiError(e) ? e.message : 'Something went wrong') } })
      .finally(() => { if (live) setBusy(false) })
    return () => { live = false }
  }, [key])

  const pages = data ? Math.max(1, Math.ceil(data.total / PER)) : 1, page = Number(get('page') || 1)
  const sel = (id: string, label: string, value: string, opts: [string, string][], on: (v: string) => void) => (
    <div className="field"><label htmlFor={id}>{label}</label><select id={id} value={value} onChange={e => on(e.target.value)}><option value="">Any</option>{opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
  )

  return (
    <section className="wrap sec mk">
      <h1 className="page-h">{catName ? `${catName} astrologers` : mode === 'call' ? 'Talk to an astrologer' : 'Chat with an astrologer'}</h1>
      <p className="lead">Compare astrologers by speciality, language, experience and price. Chat is live. Voice calls open in a later phase.</p>
      <div className="chip-row" role="tablist" aria-label="Speciality">
        <button role="tab" aria-selected={!category} className={'cchip' + (!category ? ' on' : '')} onClick={() => set('category', '')}>All</button>
        {(meta?.categories ?? []).map(c => <button key={c.slug} role="tab" aria-selected={category === c.slug} className={'cchip' + (category === c.slug ? ' on' : '')} onClick={() => set('category', c.slug)}>{c.name}</button>)}
      </div>
      {data && data.total > 0 && page === 1 && !get('q') && (
        <>
          <p className="eyebrow">Trending now</p>
          <div className="trend">{data.items.slice(0, 8).map(a => <TrendingTile key={a.slug} a={a} mode={mode} />)}</div>
        </>
      )}
      <details className="panel filters-box"><summary>Filters and search</summary>
      <div className="filters">
        <div className="field"><label htmlFor="aq">Search by name</label><input id="aq" value={q} onChange={e => setQ(e.target.value)} maxLength={60} /></div>
        {!catParam && sel('acat', 'Speciality', category, (meta?.categories ?? []).map(c => [c.slug, c.name]), v => set('category', v))}
        {sel('alang', 'Language', get('language'), (meta?.languages ?? []).map(l => [l.code, l.name]), v => set('language', v))}
        {sel('agen', 'Gender', get('gender'), [['female', 'Female'], ['male', 'Male']], v => set('gender', v))}
        {sel('aexp', 'Experience', get('minExperience'), [['5', '5+ years'], ['10', '10+ years'], ['15', '15+ years']], v => set('minExperience', v))}
        {sel('aprice', 'Price per minute', get('maxPrice'), [['2000', 'Up to ₹20'], ['3000', 'Up to ₹30'], ['5000', 'Up to ₹50']], v => set('maxPrice', v))}
        {sel('asort', 'Sort by', get('sort'), [['rating', 'Rating'], ['price-low', 'Price: low to high'], ['price-high', 'Price: high to low'], ['experience', 'Experience']], v => set('sort', v))}
        <label className="check"><input type="checkbox" checked={get('online') === 'true'} onChange={e => set('online', e.target.checked ? 'true' : '')} /> Online now</label>
      </div></details>

      <div aria-live="polite">
        {err && <p className="alert" role="alert">{err}</p>}
        {busy && !data && <p className="muted">Loading…</p>}
        {data && data.total === 0 && <div className="panel"><p>No astrologers match these filters. Try removing one.</p></div>}
        {data && data.total > 0 && <p className="muted small">{data.total} astrologer{data.total === 1 ? '' : 's'}</p>}
        <div className={'agrid' + (busy ? ' dim' : '')}>{data?.items.map(a => <AstrologerCard key={a.slug} a={a} meta={meta} mode={mode} />)}</div>
        {pages > 1 && (
          <div className="row pager-row">
            <button className="btn btn-line" disabled={page <= 1} onClick={() => set('page', String(page - 1))}>Previous</button>
            <span className="muted">Page {page} of {pages}</span>
            <button className="btn btn-line" disabled={page >= pages} onClick={() => set('page', String(page + 1))}>Next</button>
          </div>
        )}
      </div>
      <aside className="astro-join-card">
        <span className="astro-join-mark" aria-hidden="true">
          <svg viewBox="0 0 48 48" focusable="false">
            <circle cx="24" cy="24" r="21" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="24" cy="24" r="12" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M24 8v32M8 24h32M12.7 12.7l22.6 22.6m0-22.6L12.7 35.3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="24" cy="24" r="3" fill="currentColor" />
          </svg>
        </span>
        <div className="astro-join-copy">
          <span className="astro-join-kicker">FOR ASTROLOGERS</span>
          <h2>Share your expertise on Jyotiva</h2>
          <p>Create your profile and help people discover your astrology practice. Applications are reviewed before profiles go live.</p>
        </div>
        <Link className="btn btn-gold astro-join-action" to="/astrologer-signup">Apply to join <span aria-hidden="true">→</span></Link>
      </aside>
    </section>
  )
}
