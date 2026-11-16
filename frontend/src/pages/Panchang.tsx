import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import PlaceInput from '../astro/PlaceInput'
import NorthChart from '../astro/NorthChart'
import type { PlaceHit } from '../astro/types'
import { isPlannedRoute } from '../data'
import { usePageMeta } from '../hooks'
import { api, isApiError } from '../services/api'
import NotFound from './NotFound'
import Placeholder from './Placeholder'

interface T { iso: string; local: string }
interface Span { start: T; end: T }
interface Pan {
  date: string; weekday: string; weekdayLord: string
  sunrise: T; sunset: T; moonrise: T | null; moonset: T | null; dayLengthMinutes: number
  tithi: { name: string; number: number; endsAt: T }
  nakshatra: { name: string; pada: number; endsAt: T }
  yoga: { name: string; endsAt: T }
  karana: { name: string; endsAt: T }
  sunSign: string; moonSign: string
  ritu: string; ayana: string
  lunarMonth: { name: string; index: number; adhika: boolean; system: string }
  vikramSamvat: { year: number; system: string }
  rahuKaal: Span; yamaganda: Span; gulika: Span; abhijit: Span; brahmaMuhurat: Span
  choghadiya: (Span & { name: string; nature: string })[]
  nightChoghadiya: (Span & { name: string; nature: string })[]
  hora: (Span & { lord: string; period: string })[]
  sunriseChart: { ascendant: { sign: number; signName: string }; houses: { house: number; sign: number; signName: string; planets: string[] }[]; planets: { name: string; signName: string; degree: number; house: number; retrograde: boolean }[] }
  notes: string[]
}

const DELHI: PlaceHit = { name: 'Delhi', state: 'Delhi', latitude: 28.6139, longitude: 77.209, timezone: 'Asia/Kolkata' }
const SIGN_NAMES = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces']
const NAK_NAMES = ['Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra', 'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha', 'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha', 'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati']
const TARAS = ['Janma', 'Sampat', 'Vipat', 'Kshema', 'Pratyari', 'Sadhaka', 'Naidhana', 'Mitra', 'Param Mitra']
const istDate = (offsetDays = 0): string => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(Date.now() + offsetDays * 86400_000))
const shift = (d: string, n: number): string => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400_000).toISOString().slice(0, 10)
const hm = (t: T) => t.local.replace(' (next day)', ' +1').replace(' (previous day)', ' −1')
const rng = (s: Span) => `${hm(s.start)} – ${hm(s.end)}`

type Sec = 'summary' | 'sun' | 'inauspicious' | 'abhijit' | 'chart' | 'choghadiya' | 'hora'
const PAGES: Record<string, { title: string; h: string; sections: Sec[] }> = {
  'today-panchang': { title: "Today's Panchang", h: "Today's Panchang", sections: ['summary', 'sun', 'inauspicious', 'abhijit', 'chart', 'choghadiya', 'hora'] },
  'tomorrow-panchang': { title: "Tomorrow's Panchang", h: "Tomorrow's Panchang", sections: ['summary', 'sun', 'inauspicious', 'abhijit', 'chart', 'choghadiya', 'hora'] },
  'rahu-kaal': { title: 'Rahu Kaal', h: 'Rahu Kaal Today', sections: ['inauspicious', 'sun'] },
  choghadiya: { title: 'Choghadiya', h: 'Choghadiya Today', sections: ['choghadiya', 'sun'] },
  hora: { title: 'Hora', h: 'Hora Today', sections: ['hora', 'sun'] },
  tithi: { title: 'Tithi', h: 'Tithi Today', sections: ['summary'] },
  vaar: { title: 'Vaar', h: 'Vaar (Weekday) Today', sections: ['summary', 'sun'] },
  karana: { title: 'Karana', h: 'Karana Today', sections: ['summary'] },
  yoga: { title: 'Yoga', h: 'Yoga Today', sections: ['summary'] },
}
export const PANCHANG_SLUGS = Object.keys(PAGES)

const Row = ({ k, children }: { k: string; children: ReactNode }) => <tr><th scope="row">{k}</th><td>{children}</td></tr>

export default function Panchang() {
  const { pathname } = useLocation()
  const { slug: routeSlug, city: citySlug } = useParams()
  const slug = routeSlug ?? pathname.split('/').filter(Boolean)[1] ?? 'today-panchang'
  const knownPage = Object.prototype.hasOwnProperty.call(PAGES, slug)
  const page = knownPage ? PAGES[slug] : PAGES['today-panchang']
  const [date, setDate] = useState(slug === 'tomorrow-panchang' ? istDate(1) : istDate())
  const [place, setPlace] = useState<PlaceHit | null>(DELHI)
  const [data, setData] = useState<Pan | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [cities, setCities] = useState<(PlaceHit & { slug: string })[]>([])
  const [janmaRashi, setJanmaRashi] = useState('')
  const [janmaNakshatra, setJanmaNakshatra] = useState('')
  usePageMeta(`${page.title} for ${place?.name ?? 'your city'}`, { description: `Tithi, nakshatra, yoga, karana, Rahu Kaal, Choghadiya and Hora for ${date}.` })

  useEffect(() => {
    api<{ cities: (PlaceHit & { slug: string })[] }>('/tools/cities', { auth: false }).then(r => setCities(r.cities)).catch(() => setCities([]))
  }, [])

  useEffect(() => {
    if (!citySlug) { setPlace(DELHI); return }
    if (!cities.length) return
    const match = cities.find(c => c.slug === citySlug)
    if (match) { setPlace(match); setErr('') } else { setPlace(null); setErr('Unknown city Panchang page.') }
  }, [citySlug, cities])

  useEffect(() => { setDate(slug === 'tomorrow-panchang' ? istDate(1) : istDate()) }, [slug])
  useEffect(() => {
    if (!knownPage || !place) return
    let live = true
    setBusy(true); setErr('')
    api<Pan>('/tools/panchang', { method: 'POST', body: { date, latitude: place.latitude, longitude: place.longitude, timezone: place.timezone }, auth: false })
      .then(r => { if (live) setData(r) })
      .catch(e => { if (live) { setData(null); setErr(isApiError(e) ? (e.code === 'NETWORK' ? "Can't reach the server. Check your connection." : e.message) : 'Something went wrong') } })
      .finally(() => { if (live) setBusy(false) })
    return () => { live = false }
  }, [date, knownPage, place])

  const now = Date.now()
  const dateLabel = new Date(`${date}T12:00:00+05:30`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const links = useMemo(() => PANCHANG_SLUGS.filter(s => s !== slug), [slug])
  const has = (s: Sec) => page.sections.includes(s)

  if (!knownPage) return isPlannedRoute(pathname) ? <Placeholder /> : <NotFound />

  return (
    <section className="wrap sec panchang-page">
      <div className="panchang-heading">
        <div className="panchang-heading-copy">
          <span className="panchang-kicker">CITY-SPECIFIC VEDIC ALMANAC</span>
          <h1 className="page-h">{page.h}{place ? <> <span className="panchang-city-separator" aria-hidden="true">·</span> {place.name}</> : ''}</h1>
          <p className="lead">Daily tithi, nakshatra, muhurat timings and planetary details for your city.</p>
        </div>
        <div className="panchang-date-card"><span>SELECTED DATE</span><b>{dateLabel}</b><small>{place?.name ?? 'Choose a city'} · local time</small></div>
      </div>
      <div className="panchang-controls-wrap">
        <div className="panchang-control-title"><b>Choose date and city</b><span>Timings update for your selected location.</span></div>
        <div className="panel pan-controls panchang-controls">
          <div className="panchang-date-control"><label htmlFor="panchang-date">Date</label><div className="pager">
            <button className="btn btn-line" onClick={() => setDate(shift(date, -1))} aria-label="Previous day">&#x2039;</button>
            <input id="panchang-date" type="date" value={date} min="1900-01-01" max="2100-12-31" onChange={e => e.target.value && setDate(e.target.value)} aria-label="Date" />
            <button className="btn btn-line" onClick={() => setDate(shift(date, 1))} aria-label="Next day">&#x203A;</button>
            <button className="btn btn-line panchang-today" onClick={() => setDate(istDate())}>Today</button>
          </div></div>
          <PlaceInput label="City" value={place} onChange={setPlace} />
        </div>
      </div>

      <div className="panchang-content-layout">
        <div className="panchang-main">
          <div aria-live="polite">
        {busy && !data && <p className="muted">Calculating…</p>}
        {err && <p className="alert" role="alert">{err}</p>}
        {data && (
          <div className={'results' + (busy ? ' dim' : '')}>
            <div className="panchang-day-note"><span className="panchang-day-icon" aria-hidden="true">&#x2726;</span><p><b>{data.weekday}</b><span>{data.date} · Hindu day begins at sunrise</span></p><small>Sunrise {hm(data.sunrise)} <i /> Sunset {hm(data.sunset)}</small></div>
            <div className="panchang-glance">
              <article><span>TITHI</span><b>{data.tithi.name}</b><small>Until {hm(data.tithi.endsAt)}</small></article>
              <article><span>NAKSHATRA</span><b>{data.nakshatra.name}</b><small>Pada {data.nakshatra.pada} · until {hm(data.nakshatra.endsAt)}</small></article>
              <article><span>YOGA</span><b>{data.yoga.name}</b><small>Until {hm(data.yoga.endsAt)}</small></article>
              <article><span>KARANA</span><b>{data.karana.name}</b><small>Until {hm(data.karana.endsAt)}</small></article>
            </div>
            {busy && <p className="panchang-refresh-note" role="status">Updating timings for this selection…</p>}

            {has('summary') && (
              <div className="panel"><h2>Panchang</h2><table className="tbl kv"><tbody>
                <Row k="Tithi">{data.tithi.name} <span className="muted">until {hm(data.tithi.endsAt)}</span></Row>
                <Row k="Vaar">{data.weekday} <span className="muted">(lord: {data.weekdayLord})</span></Row>
                <Row k="Nakshatra">{data.nakshatra.name}, pada {data.nakshatra.pada} <span className="muted">until {hm(data.nakshatra.endsAt)}</span></Row>
                <Row k="Yoga">{data.yoga.name} <span className="muted">until {hm(data.yoga.endsAt)}</span></Row>
                <Row k="Karana">{data.karana.name} <span className="muted">until {hm(data.karana.endsAt)}</span></Row>
                <Row k="Sun sign / Moon sign">{data.sunSign} / {data.moonSign}</Row>
                <Row k="Ritu / Ayana">{data.ritu} / {data.ayana}</Row>
                <Row k="Lunar month">{data.lunarMonth.adhika ? 'Adhika ' : ''}{data.lunarMonth.name} <span className="muted">(Amanta)</span></Row>
                <Row k="Vikram Samvat">{data.vikramSamvat.year} <span className="muted">(Chaitradi convention)</span></Row>
              </tbody></table><p className="muted small">Shown as running at sunrise. "Until" is when it changes. Lunar month uses Amanta; Samvat uses the Chaitradi Vikram convention. Regional calendars can differ, so confirm dates with a local almanac.</p></div>
            )}

            {has('summary') && (
              <div className="panel"><h2>Chandrabalam &amp; Tarabalam</h2>
                <p className="muted small">Optional: select your birth Moon sign and Janma Nakshatra from your Kundli. This shows traditional relative counts only.</p>
                <div className="form-grid">
                  <label className="field">Birth Moon sign<select value={janmaRashi} onChange={e => setJanmaRashi(e.target.value)}><option value="">Choose a sign</option>{SIGN_NAMES.map((s, i) => <option key={s} value={i}>{s}</option>)}</select></label>
                  <label className="field">Janma Nakshatra<select value={janmaNakshatra} onChange={e => setJanmaNakshatra(e.target.value)}><option value="">Choose a nakshatra</option>{NAK_NAMES.map((n, i) => <option key={n} value={i}>{n}</option>)}</select></label>
                </div>
                {(janmaRashi !== '' || janmaNakshatra !== '') && <table className="tbl kv"><tbody>
                  {janmaRashi !== '' && (() => { const count = (SIGN_NAMES.indexOf(data.moonSign) - Number(janmaRashi) + 12) % 12 + 1; const group = [1, 3, 6, 7, 10, 11].includes(count) ? 'Commonly favorable' : [2, 5, 9].includes(count) ? 'Neutral' : 'Weak'; return <Row k="Chandrabalam">{count}th sign · {group}</Row> })()}
                  {janmaNakshatra !== '' && (() => { const today = NAK_NAMES.indexOf(data.nakshatra.name); const count = (today - Number(janmaNakshatra) + 27) % 27 + 1; const tara = (count - 1) % 9 + 1; const group = [3, 5, 7].includes(tara) ? 'Traditionally challenging' : tara === 1 ? 'Mixed' : 'Traditionally supportive'; return <Row k="Tarabalam">{TARAS[tara - 1]} · {group}</Row> })()}
                </tbody></table>}
                <p className="muted small">Common Chandra Bala count: 1, 3, 6, 7, 10 and 11 are treated as supportive; regional rules differ. For important ceremonies, consult a complete local Panchang.</p>
              </div>
            )}

            {has('sun') && (
              <div className="panel"><h2>Sun and Moon</h2><table className="tbl kv"><tbody>
                <Row k="Sunrise">{hm(data.sunrise)}</Row><Row k="Sunset">{hm(data.sunset)}</Row>
                <Row k="Moonrise">{data.moonrise ? hm(data.moonrise) : 'None on this date'}</Row><Row k="Moonset">{data.moonset ? hm(data.moonset) : 'None on this date'}</Row>
                <Row k="Day length">{Math.floor(data.dayLengthMinutes / 60)} h {data.dayLengthMinutes % 60} min</Row>
              </tbody></table></div>
            )}

            {has('inauspicious') && (
              <div className="panel"><h2>Inauspicious periods</h2><table className="tbl kv"><tbody>
                <Row k="Rahu Kaal"><b>{rng(data.rahuKaal)}</b></Row><Row k="Yamaganda">{rng(data.yamaganda)}</Row><Row k="Gulika Kaal">{rng(data.gulika)}</Row>
              </tbody></table></div>
            )}

            {has('abhijit') && (
              <div className="panel"><h2>Auspicious periods</h2><table className="tbl kv"><tbody><Row k="Brahma Muhurat">{rng(data.brahmaMuhurat)}</Row><Row k="Abhijit Muhurat">{rng(data.abhijit)}</Row></tbody></table>
                <p className="muted small">Brahma Muhurat uses the common fixed 48-minute window from 96 to 48 minutes before sunrise; definitions may vary. Some traditions treat Abhijit as unfavourable on Wednesdays.</p></div>
            )}

            {has('chart') && (
              <div className="panel panchang-chart-panel"><h2>Planet positions at sunrise</h2><p className="muted small">Ascendant: {data.sunriseChart.ascendant.signName}. These are calculated for the selected date and city.</p>
                <NorthChart k={data.sunriseChart} label={`Panchang sunrise chart, ${data.sunriseChart.ascendant.signName} ascendant`} />
                <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Planet</th><th>Sign</th><th>Degree</th><th>House</th></tr></thead><tbody>{data.sunriseChart.planets.map(p => <tr key={p.name}><td>{p.name}{p.retrograde ? ' (R)' : ''}</td><td>{p.signName}</td><td>{p.degree.toFixed(2)}°</td><td>{p.house}</td></tr>)}</tbody></table></div>
              </div>
            )}

            {has('choghadiya') && (
              <>
                <div className="panel"><h2>Day Choghadiya</h2><div className="tbl-wrap"><table className="tbl">
                  <tbody>{data.choghadiya.map(c => (
                    <tr key={c.start.iso} className={Date.parse(c.start.iso) <= now && now < Date.parse(c.end.iso) ? 'hl' : ''}>
                      <td><b>{c.name}</b></td><td>{c.nature}</td><td>{rng(c)}</td>
                    </tr>))}</tbody></table></div></div>
                <div className="panel"><h2>Night Choghadiya</h2><div className="tbl-wrap"><table className="tbl">
                  <tbody>{data.nightChoghadiya.map(c => (
                    <tr key={c.start.iso} className={Date.parse(c.start.iso) <= now && now < Date.parse(c.end.iso) ? 'hl' : ''}>
                      <td><b>{c.name}</b></td><td>{c.nature}</td><td>{rng(c)}</td>
                    </tr>))}</tbody></table></div>
                  <p className="muted small">Uses a common weekday-specific night sequence. Regional Panchang conventions can differ.</p></div>
              </>
            )}

            {has('hora') && (
              <div className="panel"><h2>Hora (planetary hours)</h2><div className="tbl-wrap"><table className="tbl">
                <tbody>{data.hora.map(h => (
                  <tr key={h.start.iso} className={Date.parse(h.start.iso) <= now && now < Date.parse(h.end.iso) ? 'hl' : ''}>
                    <td><b>{h.lord}</b></td><td>{h.period}</td><td>{rng(h)}</td>
                  </tr>))}</tbody></table></div></div>
            )}
            <p className="muted small">Sidereal (Lahiri), computed for {place?.name} with astronomy-engine. For guidance only; please confirm important dates with your family priest or a printed almanac.</p>
          </div>
        )}
          </div>
        </div>
        <aside className="panchang-sidebar">
          <nav className="panchang-link-panel" aria-label="More Panchang pages">
            <div className="panchang-link-heading"><div><span className="panchang-kicker">EXPLORE</span><h2>Panchang tools</h2></div></div>
            <div className="panchang-link-row">{links.map(key => <Link key={key} to={'/panchang/'+key} aria-current={key === slug ? 'page' : undefined}>{PAGES[key].title}<span aria-hidden="true">&#x2192;</span></Link>)}</div>
          </nav>
          <nav className="panchang-link-panel panchang-cities" aria-label="Panchang by city">
            <div className="panchang-link-heading"><div><span className="panchang-kicker">LOCAL TIMINGS</span><h2>By city</h2></div></div>
            <div className="panchang-link-row">{cities.filter(city => ['delhi','mumbai','kolkata','chennai','bengaluru','hyderabad','jaipur','pune','ahmedabad','lucknow','varanasi','patna'].includes(city.slug)).map(city => <Link key={city.slug} to={`/panchang/today-panchang/${city.slug}`}>{city.name}<span aria-hidden="true">&#x2192;</span></Link>)}</div>
          </nav>
        </aside>
      </div>
    </section>
  )
}
