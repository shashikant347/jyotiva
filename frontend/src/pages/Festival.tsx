import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { usePrefs } from '../context/PrefsContext'
import { usePageMeta } from '../hooks'
import { api, isApiError } from '../services/api'

interface FestivalItem { slug: string; title: string; date: string; region: string; language: 'en' | 'hi'; tithi: string; paksha: string; description: string; isSample?: boolean }
const currentYear = new Date().getFullYear()
const dateLabel = (date: string, lang: string) => new Intl.DateTimeFormat(lang === 'hi' ? 'hi-IN' : 'en-IN', { dateStyle: 'long', timeZone: 'Asia/Kolkata' }).format(new Date(`${date}T00:00:00+05:30`))

export function FestivalCalendar() {
  const { lang } = usePrefs()
  const [year, setYear] = useState(currentYear)
  const [items, setItems] = useState<FestivalItem[]>([])
  const [error, setError] = useState('')
  usePageMeta('Festival Calendar', { description: 'Browse editor-verified festival dates and details by year.' })
  useEffect(() => { api<{ items: FestivalItem[] }>(`/festivals?year=${year}&lang=${lang}`, { auth: false }).then(r => { setItems(r.items); setError('') }).catch(e => setError(isApiError(e) ? e.message : 'Could not load festivals.')) }, [year, lang])
  return <section className="wrap sec settings"><h1 className="page-h">Festival Calendar</h1><p className="lead">Dates are entered by our editors from a regional almanac. Festival observance can vary by location and tradition.</p>
    <div className="field" style={{ maxWidth: 220 }}><label htmlFor="festival-year">Year</label><select id="festival-year" value={year} onChange={e => setYear(Number(e.target.value))}>{Array.from({ length: 7 }, (_, i) => currentYear - 2 + i).map(y => <option key={y}>{y}</option>)}</select></div>
    {error && <p className="alert" role="alert">{error}</p>}
    {!items.length && !error && <div className="panel"><p>No verified festival entries are published for {year} yet.</p></div>}
    {items.some(f => f.isSample) && <p className="notice">DEMO PREVIEW: sample cards are fictional and do not show real festival dates.</p>}
    <div className="cats">{items.map(f => <article className="panel" key={f.slug}>{f.isSample && <p className="notice">DEMO ONLY — fictional date</p>}<p className="muted small">{dateLabel(f.date, lang)} · {f.region}</p><h2>{f.title}</h2>{f.tithi && <p className="muted small">{f.paksha} {f.tithi}</p>}<Link className="btn btn-line sm" to={`/festival/${f.slug}`}>Details</Link></article>)}</div>
  </section>
}

export function FestivalDetail() {
  const { slug = '' } = useParams()
  const { lang } = usePrefs()
  const [item, setItem] = useState<FestivalItem | null>(null)
  const [error, setError] = useState('')
  usePageMeta(item?.title ?? 'Festival', { description: item ? `${item.title} on ${item.date} · ${item.region}.` : undefined })
  useEffect(() => { api<FestivalItem>(`/festivals/${encodeURIComponent(slug)}?lang=${lang}`, { auth: false }).then(setItem).catch(e => setError(isApiError(e) ? e.message : 'Could not load this festival.')) }, [slug, lang])
  return <section className="wrap sec settings"><Link to="/festival" className="linkish">← Festival calendar</Link>{error && <p className="alert" role="alert">{error}</p>}{item && <article className="panel">{item.isSample && <p className="notice">DEMO ONLY — fictional preview, not a real festival or date.</p>}<h1 className="page-h">{item.title}</h1><p className="lead">{dateLabel(item.date, lang)} · {item.region}</p>{item.tithi && <p>{item.paksha} {item.tithi}</p>}<p className="horo-text">{item.description}</p><p className="muted small">Festival dates may vary by regional calendar. Confirm locally before making plans.</p></article>}</section>
}
