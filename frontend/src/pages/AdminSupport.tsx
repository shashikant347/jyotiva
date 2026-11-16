import { useCallback, useEffect, useState } from 'react'
import { hasAdminAccess } from '../adminAccess'
import { useAuth } from '../context/AuthContext'
import { Link } from 'react-router-dom'
import { usePageMeta } from '../hooks'
import { api, isApiError } from '../services/api'
import { STATUS_LABEL, Thread } from './Support'

interface Row { id: string; subject: string; category: string; status: 'open' | 'pending' | 'resolved'; updatedAt: string; userName: string; userPhone: string }

export default function AdminSupport() {
  usePageMeta('Admin: support', { noindex: true })
  const { user } = useAuth()
  const [status, setStatus] = useState('open'), [rows, setRows] = useState<Row[]>([]), [sel, setSel] = useState<string | null>(null), [err, setErr] = useState('')
  const load = useCallback(() => { api<{ items: Row[] }>(`/admin/support/tickets?status=${status}`).then(r => setRows(r.items)).catch(e => setErr(isApiError(e) ? e.message : 'Something went wrong')) }, [status])
  useEffect(() => { if (hasAdminAccess(user, ['support'])) load() }, [load, user])
  if (!hasAdminAccess(user, ['support'])) return <section className="wrap sec"><h1 className="page-h">Not allowed</h1><p className="lead">This page is for support administrators.</p></section>
  return (
    <section className="wrap sec settings">
      <h1 className="page-h">Support tickets</h1>
      <p><Link className="btn btn-line" to="/admin/chat-reports">Review chat reports</Link></p>
      <div className="tabs">{(['open', 'pending', 'resolved'] as const).map(s => <button key={s} className={s === status ? 'on' : ''} onClick={() => { setStatus(s); setSel(null) }}>{STATUS_LABEL[s]}</button>)}</div>
      {err && <p className="alert" role="alert">{err}</p>}
      {sel ? <><button className="btn btn-line sm" onClick={() => setSel(null)}>Back to the list</button><Thread base="/admin/support" id={sel} admin onChange={load} /></> : (
        <div className="panel">
          {rows.length === 0 && <p className="empty">No tickets here.</p>}
          {rows.map(t => <button key={t.id} className="trow" onClick={() => setSel(t.id)}><span><b>{t.subject}</b><br /><span className="muted small">{t.userName} · {t.userPhone} · {t.category}</span></span><span className={'tstatus ' + t.status}>{STATUS_LABEL[t.status]}</span></button>)}
        </div>
      )}
    </section>
  )
}
