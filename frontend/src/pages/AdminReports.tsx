import { useState } from 'react'
import { hasAdminAccess } from '../adminAccess'
import { useAuth } from '../context/AuthContext'
import { usePageMeta } from '../hooks'
import { downloadFile, isApiError } from '../services/api'

type ReportType = 'payments' | 'sessions'
const today = new Date().toISOString().slice(0, 10)
const monthStart = `${today.slice(0, 7)}-01`

export default function AdminReports() {
  usePageMeta('Admin: reports', { noindex: true })
  const { user } = useAuth()
  const [from, setFrom] = useState(monthStart)
  const [to, setTo] = useState(today)
  const [downloading, setDownloading] = useState<ReportType | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  if (!hasAdminAccess(user, ['finance'])) return <section className="wrap sec"><h1 className="page-h">Not allowed</h1><p className="lead">This page is for finance administrators.</p></section>

  async function exportReport(type: ReportType) {
    setError('')
    setMessage('')
    if (!from || !to || from > to) {
      setError('Choose a valid date range with the start date on or before the end date.')
      return
    }
    setDownloading(type)
    const params = new URLSearchParams({ type, from, to })
    try {
      await downloadFile(`/admin/reports/export?${params}`, `jyotiva-${type}-${from}-to-${to}.csv`)
      setMessage(`${type === 'payments' ? 'Payment' : 'Session'} report downloaded.`)
    } catch (e) {
      setError(isApiError(e) ? e.message : 'Could not download the report.')
    } finally {
      setDownloading(null)
    }
  }

  return (
    <section className="wrap sec settings">
      <h1 className="page-h">Reports</h1>
      <p className="lead">Export payment and consultation records for finance and operations.</p>
      <div className="panel form">
        <div className="row2">
          <div className="field"><label htmlFor="report-from">From (UTC)</label><input id="report-from" type="date" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)} required /></div>
          <div className="field"><label htmlFor="report-to">To (UTC)</label><input id="report-to" type="date" value={to} min={from || undefined} max={today} onChange={e => setTo(e.target.value)} required /></div>
        </div>
        {error && <p className="alert" role="alert">{error}</p>}
        {message && <p className="notice" role="status">{message}</p>}
        <div className="row">
          <button className="btn btn-gold" disabled={downloading !== null} onClick={() => exportReport('payments')}>{downloading === 'payments' ? 'Preparing…' : 'Download payments CSV'}</button>
          <button className="btn btn-line" disabled={downloading !== null} onClick={() => exportReport('sessions')}>{downloading === 'sessions' ? 'Preparing…' : 'Download sessions CSV'}</button>
        </div>
        <p className="muted small">Exports use UTC calendar dates, include up to 366 days and are limited to 50,000 rows per file. Monetary amounts are integer paise. Narrow the date range if an export is too large.</p>
      </div>
    </section>
  )
}
