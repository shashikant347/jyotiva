import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import BirthFields, { emptyBirth, toPayload, validateBirth, type BirthState } from '../astro/BirthFields'
import NorthChart from '../astro/NorthChart'
import SouthChart from '../astro/SouthChart'
import type { DashaPeriod, DivisionalChart, KundliResult } from '../astro/types'
import { usePageMeta } from '../hooks'
import { api, isApiError } from '../services/api'
import { fieldErrors } from '../utils'
import { useAuth } from '../context/AuthContext'

const fmtDeg = (d: number) => `${Math.floor(d)}° ${String(Math.floor((d % 1) * 60)).padStart(2, '0')}′`
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
interface SavedKundli { id: string; name: string; birthDate: string; birthTime: string | null; latitude: number; longitude: number; timezone: string; createdAt: string }

function Dasha({ list }: { list: DashaPeriod[] }) {
  const now = Date.now()
  return (
    <div className="dasha">
      {list.map(p => {
        const current = new Date(p.start).getTime() <= now && now < new Date(p.end).getTime()
        return (
          <details key={p.lord + p.start} open={current}>
            <summary><b>{p.lord}</b> <span className="muted">{fmtDate(p.start)} – {fmtDate(p.end)}</span>{current && <span className="badge">Running</span>}</summary>
            <table className="tbl"><tbody>
              {p.sub?.map(s => (
                <tr key={s.lord + s.start} className={new Date(s.start).getTime() <= now && now < new Date(s.end).getTime() ? 'hl' : ''}>
                  <td>{p.lord}–{s.lord}</td><td>{fmtDate(s.start)}</td><td>{fmtDate(s.end)}</td>
                </tr>
              ))}
            </tbody></table>
          </details>
        )
      })}
    </div>
  )
}

export default function FreeKundli() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  usePageMeta('Free Kundli (Janam Kundali)', { description: 'Generate your free Vedic Kundli: birth chart, planetary positions, Vimshottari dasha and dosha checks.' })
  const [b, setB] = useState<BirthState>(emptyBirth())
  const [errs, setErrs] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [res, setRes] = useState<KundliResult | null>(null)
  const [varga, setVarga] = useState(1)
  const [chartStyle, setChartStyle] = useState<'north' | 'south'>('north')
  const [saved, setSaved] = useState<SavedKundli[]>([])
  const [saveMsg, setSaveMsg] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) { setSaved([]); return }
    api<SavedKundli[]>('/me/kundlis').then(setSaved).catch(() => setSaved([]))
  }, [user])

  useEffect(() => {
    if (!id || !user) return
    let live = true
    setBusy(true); setMsg('')
    api<SavedKundli>(`/me/kundlis/${encodeURIComponent(id)}`)
      .then(k => api<KundliResult>('/tools/kundli', { method: 'POST', body: k, auth: false }))
      .then(k => { if (live) setRes(k) })
      .catch(e => { if (live) { setRes(null); setMsg(isApiError(e) ? e.message : 'Could not load the saved Kundli.') } })
      .finally(() => { if (live) setBusy(false) })
    return () => { live = false }
  }, [id, user])

  async function submit(e: FormEvent) {
    e.preventDefault()
    const v = validateBirth(b)
    setErrs(v); setMsg('')
    if (Object.keys(v).length) return
    setBusy(true)
    try {
      setRes(await api<KundliResult>('/tools/kundli', { method: 'POST', body: toPayload(b), auth: false }))
    } catch (err) {
      setRes(null)
      setErrs(fieldErrors(err))
      setMsg(isApiError(err) ? (err.code === 'NETWORK' ? "Can't reach the server. Check your connection." : err.message) : 'Something went wrong')
    } finally { setBusy(false) }
  }

  async function saveKundli() {
    if (!user || !b.place || !b.date) return
    setSaving(true); setSaveMsg('')
    const payload = { ...toPayload(b), name: b.name.trim() || user.name || 'My Kundli' }
    try {
      const item = await api<SavedKundli>('/me/kundlis', { method: 'POST', body: payload })
      setSaved(xs => [item, ...xs]); setSaveMsg('Kundli saved to your account.')
    } catch (e) { setSaveMsg(isApiError(e) ? e.message : 'Could not save this Kundli.') }
    finally { setSaving(false) }
  }

  async function deleteKundli(item: SavedKundli) {
    try {
      await api(`/me/kundlis/${encodeURIComponent(item.id)}`, { method: 'DELETE' })
      setSaved(xs => xs.filter(x => x.id !== item.id))
      if (id === item.id) navigate('/freekundli')
    } catch (e) { setSaveMsg(isApiError(e) ? e.message : 'Could not delete this Kundli.') }
  }

  const asc = res?.kundli.ascendant
  const selectedChart: DivisionalChart | undefined = res?.kundli.divisionalCharts?.find(c => c.varga === varga)
  return (
    <section className="wrap sec">
      <h1 className="page-h">Free Kundli</h1>
      <p className="lead">Enter your birth details to see your Vedic birth chart, planet positions, Vimshottari dasha and common dosha checks.</p>
      <div className="kundli-grid">
        <form className="panel form" onSubmit={submit} noValidate>
          <BirthFields value={b} onChange={setB} errors={errs} />
          {msg && <p className="alert" role="alert">{msg}</p>}
          <button className="btn btn-gold" disabled={busy}>{busy ? 'Calculating…' : 'Generate Kundli'}</button>
          {!user && <p className="muted small">Sign in to save Kundlis to your account. <Link to="/login">Sign in</Link></p>}
          {user && <div className="saved-kundlis"><h2>Saved Kundlis</h2>{saved.length ? <ul className="bp-list">{saved.map(item => <li className="bp-row" key={item.id}><div><Link to={`/freekundli/result/${item.id}`}><b>{item.name}</b></Link><p className="muted small">{item.birthDate} · Saved {fmtDate(item.createdAt)}</p></div><button type="button" className="linkish danger" onClick={() => void deleteKundli(item)}>Delete</button></li>)}</ul> : <p className="empty">No saved Kundlis yet.</p>}</div>}
        </form>

        <div className="results" id="kundli-report" aria-live="polite">
          {!res && <div className="panel"><p className="empty">Your chart will appear here.</p></div>}
          {res && asc && (
            <>
              <div className="panel">
                <h2>{res.name ? `${res.name}'s Kundli` : 'Your Kundli'}</h2>
                <button type="button" className="btn btn-gold no-print" onClick={() => window.print()}>Print / Save as PDF</button>
                {!id && user && <button type="button" className="btn no-print" onClick={() => void saveKundli()} disabled={saving}>{saving ? 'Saving…' : 'Save Kundli'}</button>}
                {saveMsg && <p className="notice no-print" role="status">{saveMsg}</p>}
                {id && <Link className="linkish no-print" to="/freekundli">Generate another Kundli</Link>}
                {res.warnings.map(w => <p key={w} className="notice">{w}</p>)}
                <div className="summary">
                  <div><span className="muted small">Lagna (ascendant)</span><b>{asc.signName} {fmtDeg(asc.degree)}</b></div>
                  <div><span className="muted small">Moon sign (Rashi)</span><b>{res.moon.signName}</b></div>
                  <div><span className="muted small">Nakshatra</span><b>{res.moon.nakshatraName}, pada {res.moon.pada}</b></div>
                </div>
                <div className="row2">
                  <div className="field"><label htmlFor="varga-select">Chart</label><select id="varga-select" value={varga} onChange={e => setVarga(Number(e.target.value))}>{res.kundli.divisionalCharts?.map(c => <option key={c.varga} value={c.varga}>{c.name}</option>)}</select></div>
                  <div className="field"><label htmlFor="chart-style">Chart style</label><select id="chart-style" value={chartStyle} onChange={e => setChartStyle(e.target.value as 'north' | 'south')}><option value="north">North Indian</option><option value="south">South Indian</option></select></div>
                </div>
                {selectedChart && (chartStyle === 'north' ? <NorthChart k={selectedChart} label={`${selectedChart.name} North Indian chart, ${selectedChart.ascendant.signName} ascendant`} /> : <SouthChart chart={selectedChart} label={`${selectedChart.name} South Indian chart, ${selectedChart.ascendant.signName} ascendant`} />)}
                <p className="muted small">Divisional placements use common Parashari sign allocation rules. Traditions may differ; verify important charts with a trusted reference.</p>
              </div>

              <div className="panel">
                <h2>Planet positions</h2>
                <div className="tbl-wrap"><table className="tbl">
                  <thead><tr><th>Planet</th><th>Sign</th><th>Degree</th><th>Nakshatra</th><th>House</th></tr></thead>
                  <tbody>
                    <tr><td>Lagna</td><td>{asc.signName}</td><td>{fmtDeg(asc.degree)}</td><td>{asc.nakshatraName} ({asc.pada})</td><td>1</td></tr>
                    {res.kundli.planets.map(p => (
                      <tr key={p.name}><td>{p.name}{p.retrograde ? ' (R)' : ''}</td><td>{p.signName}</td><td>{fmtDeg(p.degree)}</td><td>{p.nakshatraName} ({p.pada})</td><td>{p.house}</td></tr>
                    ))}
                  </tbody>
                </table></div>
                <p className="muted small">(R) = retrograde. Rahu and Ketu are the mean lunar nodes and always move backward.</p>
              </div>

              <div className="panel">
                <h2>Dosha checks</h2>
                <ul className="doshas">
                  <li><b>Mangal dosha:</b> {res.doshas.mangal.present ? 'Present' : 'Not present'} <span className="muted small">(Mars is in house {res.doshas.mangal.marsHouseFromLagna} from Lagna and {res.doshas.mangal.marsHouseFromMoon} from Moon)</span></li>
                  <li><b>Kaal Sarp dosha:</b> {res.doshas.kaalSarp.present ? 'Present' : 'Not present'}</li>
                  <li><b>Sade Sati (as of {res.doshas.sadeSati.asOf}):</b> {res.doshas.sadeSati.active ? res.doshas.sadeSati.phase : 'Not running'} <span className="muted small">(Saturn in {res.doshas.sadeSati.saturnSign}, natal Moon in {res.doshas.sadeSati.moonSign})</span></li>
                </ul>
                <p className="muted small">{res.doshas.mangal.note} These are simple rule-based checks, not a full reading; cancellations and strength are not assessed.</p>
              </div>

              <div className="panel">
                <h2>Vimshottari dasha</h2>
                <Dasha list={res.dasha} />
              </div>

              <p className="muted small">Method: {res.method.zodiac}, {res.method.houses} houses, {res.method.nodes}. Calculated with {res.method.ephemeris}. For guidance only, not professional advice.</p>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
