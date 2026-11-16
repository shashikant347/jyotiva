import { useEffect, useState } from 'react'
import { hasAdminAccess } from '../adminAccess'
import { useAuth } from '../context/AuthContext'
import { usePageMeta } from '../hooks'
import { api, isApiError } from '../services/api'

interface Result { imported: number; created: number; updated: number; applied: boolean; status?: string; errors: { row: number; message: string }[] }
interface Entry { id: string; sign: number; period: string; category: string; language: string; dateFrom: string; dateTo: string; text: string; luckyNumber: number | null; luckyColor: string | null; mood: string | null; loveScore: number | null; careerScore: number | null; healthScore: number | null; moneyScore: number | null; status: 'draft' | 'scheduled' | 'published' }
const SIGNS = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces']
const HEADER = 'sign,period,category,language,date_from,date_to,text,lucky_number,lucky_color,mood,love_score,career_score,health_score,money_score'
const csvCell = (v: unknown) => { const s = v === null || v === undefined ? '' : String(v); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
const rowCsv = (r: Entry) => [SIGNS[r.sign],r.period,r.category,r.language,r.dateFrom,r.dateTo,r.text,r.luckyNumber,r.luckyColor,r.mood,r.loveScore,r.careerScore,r.healthScore,r.moneyScore].map(csvCell).join(',')

export default function AdminHoroscope() {
  usePageMeta('Admin: import horoscopes', { noindex: true })
  const { user } = useAuth()
  const [csv, setCsv] = useState('')
  const [publish, setPublish] = useState(false)
  const [schedule, setSchedule] = useState(false)
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState<Result | null>(null)
  const [msg, setMsg] = useState('')
  const [rows, setRows] = useState<Entry[]>([])
  const [statusFilter, setStatusFilter] = useState('all')
  const [editing, setEditing] = useState<string | null>(null)

  async function loadRows() {
    try {
      const q = statusFilter === 'all' ? '' : `?status=${statusFilter}`
      const r = await api<{ items: Entry[] }>(`/admin/horoscopes${q}`)
      setRows(r.items)
    } catch (e) { setMsg(isApiError(e) ? e.message : 'Could not load horoscope entries.') }
  }
  useEffect(() => { void loadRows() }, [statusFilter])

  if (!hasAdminAccess(user, ['content'])) return <section className="wrap sec"><h1 className="page-h">Not allowed</h1><p className="lead">This page is for content administrators.</p></section>

  async function run(dryRun: boolean) {
    setBusy(true); setMsg(''); setRes(null)
    try {
      if (editing && !dryRun) {
        await api(`/admin/horoscopes/${encodeURIComponent(editing)}`, { method: 'PATCH', body: { csv, status: publish ? 'published' : schedule ? 'scheduled' : 'draft' } })
        setMsg('Horoscope updated.'); setEditing(null); setCsv(''); setRes(null); await loadRows()
      } else setRes(await api<Result>('/admin/horoscopes/import', { method: 'POST', body: { csv, publish, schedule, dryRun } }))
    }
    catch (e) { setMsg(isApiError(e) ? e.message : 'Something went wrong') }
    finally { setBusy(false) }
  }
  function edit(r: Entry) {
    setEditing(r.id); setCsv(HEADER + '\n' + rowCsv(r) + '\n')
    setPublish(r.status === 'published'); setSchedule(r.status === 'scheduled'); setRes(null); setMsg('Editing one horoscope entry.')
  }
  async function pick(f: File | undefined) {
    if (!f) return
    if (f.size > 800_000) { setMsg('File is too large (limit about 800 KB). Split it into several files.'); return }
    setCsv(await f.text()); setRes(null); setMsg('')
  }
  async function template() {
    // Built in the browser, so no authenticated download is needed.
    const header = 'sign,period,category,language,date_from,date_to,text,lucky_number,lucky_color,mood,love_score,career_score,health_score,money_score\n'
    const row = 'Aries,daily,general,en,2026-11-17,,"Write your own original text here.",7,Red,Energetic,4,3,4,5\n'
    const url = URL.createObjectURL(new Blob([header + row], { type: 'text/csv' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: 'horoscope-template.csv' })
    a.click(); URL.revokeObjectURL(url)
  }

  return (
    <section className="wrap sec settings">
      <h1 className="page-h">Import horoscopes</h1>
      <p className="lead">Upload a CSV with your own original horoscope text. Rows with the same sign, period, category, language and start date are updated. If any row has a problem, nothing is saved.</p>
      <div className="panel form">
        <div className="row"><button type="button" className="btn btn-line" onClick={template}>Download template</button><input type="file" accept=".csv,text/csv" aria-label="CSV file" onChange={e => pick(e.target.files?.[0])} /></div>
        <div className="field"><label htmlFor="csv">CSV content</label><textarea id="csv" rows={10} value={csv} onChange={e => { setCsv(e.target.value); setRes(null) }} spellCheck={false} /></div>
        <label className="check"><input type="checkbox" checked={publish} onChange={e => setPublish(e.target.checked)} /> Publish immediately (otherwise saved as drafts)</label>
        <label className="check"><input type="checkbox" checked={schedule} disabled={publish} onChange={e => setSchedule(e.target.checked)} /> Schedule draft rows to publish on their date_from in India</label>
        {editing && <p className="notice">Single entry edit mode. Choose Draft, Scheduled or Publish using the controls above. <button type="button" className="linkish" onClick={() => { setEditing(null); setCsv(''); setMsg('Edit cancelled.') }}>Cancel edit</button></p>}
        {msg && <p className="alert" role="alert">{msg}</p>}
        <div className="row"><button className="btn btn-line" disabled={busy || !csv.trim()} onClick={() => run(true)}>Check only</button><button className="btn btn-gold" disabled={busy || !csv.trim()} onClick={() => run(false)}>{busy ? 'Working…' : 'Import'}</button></div>
      </div>
      <div className="panel form"><div className="row"><h2 style={{ marginRight: 'auto' }}>Existing entries</h2><select aria-label="Filter horoscope status" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="all">All statuses</option><option value="draft">Drafts</option><option value="scheduled">Scheduled</option><option value="published">Published</option></select><button className="btn btn-line sm" type="button" onClick={() => void loadRows()}>Refresh</button></div>
        {rows.length ? rows.map(r => <div className="trow" key={r.id}><span><b>{SIGNS[r.sign]} · {r.period} · {r.category}</b><br /><span className="muted small">{r.dateFrom} to {r.dateTo} · {r.language} · {r.status}</span></span><button type="button" className="btn btn-line sm" onClick={() => edit(r)}>Edit</button></div>) : <p className="empty">No entries found for this filter.</p>}
      </div>
      {res && (
        <div className="panel" aria-live="polite">
          {res.errors.length === 0
            ? <p><b>{res.applied ? `Imported ${res.imported} rows (${res.created} new, ${res.updated} updated), saved as ${res.status}.` : `Looks good: ${res.imported} rows are valid. Nothing was saved yet.`}</b></p>
            : <><p><b>Nothing was saved. Fix these {res.errors.length} problem(s) and try again:</b></p>
              <ul>{res.errors.slice(0, 50).map(e => <li key={e.row}>Row {e.row}: {e.message}</li>)}</ul></>}
        </div>
      )}
    </section>
  )
}
