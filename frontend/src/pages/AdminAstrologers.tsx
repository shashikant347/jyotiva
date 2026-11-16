import { useCallback, useEffect, useState } from 'react'
import { hasAdminAccess } from '../adminAccess'
import { useAuth } from '../context/AuthContext'
import { usePageMeta } from '../hooks'
import { api, isApiError } from '../services/api'

interface Row { id: string; displayName: string; applicationStatus: string; experienceYears: number; bio: string; languages: string[]; categories: string[]; skills: string[]; isDemo: boolean; badge: string | null; chatPricePaise: number; callPricePaise: number }

export default function AdminAstrologers() {
  usePageMeta('Admin: astrologers', { noindex: true })
  const { user } = useAuth()
  const [status, setStatus] = useState('pending')
  const [rows, setRows] = useState<Row[]>([])
  const [msg, setMsg] = useState('')
  const load = useCallback(() => { api<{ items: Row[] }>(`/admin/astrologers?status=${status}`).then(r => setRows(r.items)).catch(e => setMsg(isApiError(e) ? e.message : 'Something went wrong')) }, [status])
  useEffect(() => { if (hasAdminAccess(user)) load() }, [load, user])
  if (!hasAdminAccess(user)) return <section className="wrap sec"><h1 className="page-h">Not allowed</h1><p className="lead">This page is for super administrators.</p></section>

  async function decide(id: string, s: 'approved' | 'rejected' | 'suspended') {
    setMsg('')
    try { await api(`/admin/astrologers/${id}/status`, { method: 'POST', body: { status: s } }); load() } catch (e) { setMsg(isApiError(e) ? e.message : 'Something went wrong') }
  }
  async function setBadge(id: string, badge: string) {
    setMsg('')
    try {
      await api(`/admin/astrologers/${id}/badge`, { method: 'PATCH', body: { badge: badge || null } })
      load()
    } catch (e) { setMsg(isApiError(e) ? e.message : 'Could not update badge') }
  }
  async function removeDemo() {
    if (!window.confirm('Remove all demo astrologers?')) return
    try { const r = await api<{ removed: number }>('/admin/astrologers/demo', { method: 'DELETE' }); setMsg(`Removed ${r.removed} demo profiles.`); load() } catch (e) { setMsg(isApiError(e) ? e.message : 'Something went wrong') }
  }
  return (
    <section className="wrap sec">
      <h1 className="page-h">Astrologers</h1>
      <div className="row">{['pending', 'approved', 'rejected', 'suspended'].map(s => <button key={s} className={'btn ' + (s === status ? 'btn-gold' : 'btn-line')} onClick={() => setStatus(s)}>{s}</button>)}<button className="btn btn-line" onClick={removeDemo}>Remove demo profiles</button></div>
      {msg && <p className="alert" role="alert">{msg}</p>}
      {rows.length === 0 && <p className="muted">Nothing here.</p>}
      {rows.map(r => (
        <div key={r.id} className="panel">
          <b>{r.displayName}</b> {r.isDemo && <span className="badge">Demo</span>} <span className="muted">· {r.experienceYears} years · {r.languages.join(', ')} · {r.categories.join(', ')} · {r.skills.join(', ')}</span>
          <p>{r.bio}</p>
          {r.applicationStatus === 'approved' && <div className="field" style={{ maxWidth: 260 }}><label htmlFor={`badge-${r.id}`}>Public label</label><select id={`badge-${r.id}`} value={r.badge === 'Featured' || r.badge === 'Rising Star' ? r.badge : r.badge ?? ''} onChange={e => setBadge(r.id, e.target.value)}><option value="">No label</option>{r.badge && r.badge !== 'Featured' && r.badge !== 'Rising Star' && <option value={r.badge}>{r.badge} (existing)</option>}<option value="Featured">Featured</option><option value="Rising Star">Rising Star</option></select></div>}
          <div className="row">
            {r.applicationStatus !== 'approved' && <button className="btn btn-gold" onClick={() => decide(r.id, 'approved')}>Approve</button>}
            {r.applicationStatus === 'pending' && <button className="btn btn-line" onClick={() => decide(r.id, 'rejected')}>Reject</button>}
            {r.applicationStatus === 'approved' && <button className="btn btn-line" onClick={() => decide(r.id, 'suspended')}>Suspend</button>}
          </div>
        </div>
      ))}
    </section>
  )
}
