import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { hasAdminAccess } from '../adminAccess'
import { useAuth } from '../context/AuthContext'
import { usePageMeta } from '../hooks'
import { api, isApiError } from '../services/api'

type Status = 'open' | 'actioned' | 'dismissed' | 'all'
interface Report {
  id: string; sessionId: string; reporterRole: 'user' | 'astrologer'; reportedRole: 'user' | 'astrologer'
  reporterName: string; reportedName: string; reason: string; details: string; status: Exclude<Status, 'all'>
  createdAt: string; sessionStatus: string; resolutionNote: string | null
  transcript: { senderRole: string; body: string; createdAt: string }[]
}

const REASONS: Record<string, string> = { harassment: 'Harassment', abuse: 'Abusive language or behavior', spam: 'Spam or scam', inappropriate: 'Inappropriate conduct', other: 'Other concern' }

export default function AdminChatReports() {
  usePageMeta('Admin: chat reports', { noindex: true })
  const { user } = useAuth()
  const [status, setStatus] = useState<Status>('open')
  const [items, setItems] = useState<Report[]>([])
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (!hasAdminAccess(user, ['support'])) return
    setLoading(true); setErr('')
    api<{ items: Report[] }>(`/admin/chat-reports?status=${status}`).then(r => setItems(r.items))
      .catch(e => setErr(isApiError(e) ? e.message : 'Could not load chat reports.'))
      .finally(() => setLoading(false))
  }, [status, user])

  async function decide(report: Report, next: 'actioned' | 'dismissed') {
    const note = (notes[report.id] ?? '').trim()
    if (note.length < 5) { setErr('Add a resolution note of at least 5 characters.'); return }
    setBusy(report.id); setErr('')
    try {
      await api(`/admin/chat-reports/${encodeURIComponent(report.id)}`, { method: 'PATCH', body: { status: next, note } })
      setItems(current => current.map(r => r.id === report.id ? { ...r, status: next, resolutionNote: note } : r))
    } catch (e) { setErr(isApiError(e) ? e.message : 'Could not update this report.') }
    finally { setBusy(null) }
  }

  if (!hasAdminAccess(user, ['support'])) return <section className="wrap sec"><h1 className="page-h">Not allowed</h1><p className="lead">This page is for support administrators.</p></section>
  return <section className="wrap sec settings">
    <h1 className="page-h">Chat reports</h1>
    <p className="lead">Review reports from real chat participants. Transcript access is limited to support administrators.</p>
    <p><Link to="/admin/support">Back to support tickets</Link></p>
    <div className="tabs">{(['open', 'actioned', 'dismissed', 'all'] as const).map(s => <button key={s} className={status === s ? 'on' : ''} onClick={() => setStatus(s)}>{s === 'all' ? 'All' : s[0].toUpperCase() + s.slice(1)}</button>)}</div>
    {err && <p className="alert" role="alert">{err}</p>}
    {loading ? <p className="muted">Loading reports…</p> : items.length === 0 ? <p className="empty">No reports in this view.</p> : items.map(report => <article className="panel" key={report.id}>
      <div className="sec-h"><h2>{report.reporterName} ({report.reporterRole}) reported {report.reportedName} ({report.reportedRole})</h2><span className={'tstatus ' + report.status}>{report.status}</span></div>
      <p><b>{REASONS[report.reason] ?? report.reason}</b> · Chat {report.sessionStatus} · {new Date(report.createdAt).toLocaleString()}</p>
      <p>{report.details}</p>
      {report.resolutionNote && <p className="notice">Resolution: {report.resolutionNote}</p>}
      <details><summary>Chat transcript ({report.transcript.length} latest messages)</summary>
        <div className="chat-log">{report.transcript.length ? report.transcript.map((m, i) => <div className="msg" key={`${report.id}-${i}`}><b>{m.senderRole}</b><p>{m.body}</p><small>{new Date(m.createdAt).toLocaleString()}</small></div>) : <p className="muted">No messages were sent.</p>}</div>
      </details>
      {report.status === 'open' && <div className="form">
        <label className="field" htmlFor={`report-note-${report.id}`}>Resolution note<textarea id={`report-note-${report.id}`} minLength={5} maxLength={500} rows={2} value={notes[report.id] ?? ''} onChange={e => setNotes(v => ({ ...v, [report.id]: e.target.value }))} /></label>
        <div className="row"><button className="btn btn-gold" disabled={busy === report.id} onClick={() => void decide(report, 'actioned')}>Mark action taken</button><button className="btn btn-line" disabled={busy === report.id} onClick={() => void decide(report, 'dismissed')}>Dismiss report</button></div>
      </div>}
    </article>)}
  </section>
}
