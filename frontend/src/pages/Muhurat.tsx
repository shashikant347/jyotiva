import { useState, type FormEvent } from 'react'
import PlaceInput from '../astro/PlaceInput'
import type { PlaceHit } from '../astro/types'
import { usePageMeta } from '../hooks'
import { api, isApiError } from '../services/api'
import { todayISO } from '../utils'

interface WindowItem { start: { iso: string; local: string }; end: { iso: string; local: string } }
interface DayResult { date: string; weekday: string; windows: WindowItem[] }
interface SearchResult { results: DayResult[]; method: string; note: string }
const DELHI: PlaceHit = { name: 'Delhi', state: 'Delhi', latitude: 28.6139, longitude: 77.209, timezone: 'Asia/Kolkata' }

export default function Muhurat() {
  const [place, setPlace] = useState<PlaceHit | null>(DELHI)
  const [from, setFrom] = useState(todayISO())
  const [to, setTo] = useState(todayISO())
  const [result, setResult] = useState<SearchResult | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  usePageMeta('Shubh Muhurat Finder', { description: 'Find daylight windows outside Rahu Kaal, Yamaganda and Gulika for an initial Panchang review.' })
  async function submit(e: FormEvent) {
    e.preventDefault(); setError(''); setResult(null)
    if (!place) { setError('Choose a city from the suggestions.'); return }
    setBusy(true)
    try { setResult(await api<SearchResult>('/tools/muhurat/search', { method: 'POST', body: { from, to, latitude: place.latitude, longitude: place.longitude, timezone: place.timezone }, auth: false })) }
    catch (e) { setError(isApiError(e) ? e.message : 'Could not find available periods.') }
    finally { setBusy(false) }
  }
  return <section className="wrap sec settings"><h1 className="page-h">Shubh Muhurat Finder</h1>
    <p className="lead">Screen daylight periods for a selected city and date range, excluding Rahu Kaal, Yamaganda and Gulika Kaal.</p>
    <form className="panel form" onSubmit={submit}>
      <div className="row2"><div className="field"><label htmlFor="m-from">From</label><input id="m-from" type="date" min="1900-01-01" max="2100-12-31" value={from} onChange={e => setFrom(e.target.value)} required /></div><div className="field"><label htmlFor="m-to">To (up to 31 days)</label><input id="m-to" type="date" min={from} max="2100-12-31" value={to} onChange={e => setTo(e.target.value)} required /></div></div>
      <PlaceInput label="City" value={place} onChange={setPlace} />
      {error && <p className="alert" role="alert">{error}</p>}
      <button className="btn btn-gold" disabled={busy || !place}>{busy ? 'Finding periods…' : 'Find periods'}</button>
    </form>
    {result && <><div className="notice"><b>Screening method:</b> {result.method} {result.note}</div><div className="cats">{result.results.map(day => <article className="panel" key={day.date}><h2>{day.weekday} · {day.date}</h2>{day.windows.length ? <ul>{day.windows.map(w => <li key={w.start.iso}>{w.start.local}–{w.end.local}</li>)}</ul> : <p className="muted">No daytime window remained after exclusions.</p>}</article>)}</div></>}
  </section>
}
