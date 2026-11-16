import { useEffect, useState } from 'react'
import { hasAdminAccess } from '../adminAccess'
import { useAuth } from '../context/AuthContext'
import { usePageMeta } from '../hooks'
import { api, isApiError } from '../services/api'

interface Payout {
  id: string
  astrologerId: string
  astrologerName: string
  amountPaise: number
  status: 'requested' | 'approved' | 'rejected' | 'paid'
  requestedAt: string
  reviewedAt: string | null
  paidAt: string | null
  reference: string | null
}

const money = (paise: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(paise / 100)
const STATUSES: Array<Payout['status'] | 'all'> = ['requested', 'approved', 'paid', 'rejected', 'all']

export default function AdminPayouts() {
  usePageMeta('Admin: payouts', { noindex: true })
  const { user } = useAuth()
  const [status, setStatus] = useState<Array<Payout['status'] | 'all'>[number]>('requested')
  const [items, setItems] = useState<Payout[]>([])
  const [references, setReferences] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!hasAdminAccess(user, ['finance'])) return
    let active = true
    const query = status === 'all' ? '' : `?status=${status}`
    api<{ items: Payout[] }>(`/admin/payouts${query}`).then(r => {
      if (active) setItems(r.items)
    }).catch(e => {
      if (active) setError(isApiError(e) ? e.message : 'Could not load payout requests.')
    })
    return () => { active = false }
  }, [status, user])

  if (!hasAdminAccess(user, ['finance'])) return <section className="wrap sec"><h1 className="page-h">Not allowed</h1><p className="lead">This page is for finance administrators.</p></section>

  async function decide(payout: Payout, next: 'approved' | 'rejected' | 'paid') {
    setError('')
    setMessage('')
    if (next === 'paid' && !window.confirm('Confirm the bank or UPI transfer has already completed. This only records the settlement; it does not transfer money.')) return
    setBusy(payout.id)
    try {
      await api(`/admin/payouts/${payout.id}/status`, {
        method: 'POST',
        body: { status: next, ...(next === 'paid' ? { reference: references[payout.id]?.trim() } : {}) },
      })
      setMessage(`Payout ${next}.`)
      const query = status === 'all' ? '' : `?status=${status}`
      setItems((await api<{ items: Payout[] }>(`/admin/payouts${query}`)).items)
    } catch (e) {
      setError(isApiError(e) ? e.message : 'Could not update the payout.')
    } finally {
      setBusy('')
    }
  }

  return (
    <section className="wrap sec">
      <h1 className="page-h">Payouts</h1>
      <p className="lead">Review payout requests and record manually completed transfers. This page does not initiate payments.</p>
      <div className="tabs" role="group" aria-label="Payout status">
        {STATUSES.map(s => <button key={s} className={s === status ? 'on' : ''} onClick={() => { setError(''); setStatus(s) }}>{s === 'all' ? 'All' : s}</button>)}
      </div>
      {error && <p className="alert" role="alert">{error}</p>}
      {message && <p className="notice" role="status">{message}</p>}
      {items.length === 0 ? <p className="empty">No payout requests in this category.</p> : (
        <div className="audit-list">
          {items.map(p => (
            <article className="panel payout-row" key={p.id}>
              <div>
                <h2>{p.astrologerName}</h2>
                <p className="muted small">Requested {new Date(p.requestedAt).toLocaleString()} · {p.id}</p>
                <p><b>{money(p.amountPaise)}</b> · {p.status}</p>
                {p.status === 'paid' && <p className="muted small">Settled {p.paidAt ? new Date(p.paidAt).toLocaleString() : ''} · Ref: {p.reference}</p>}
              </div>
              {p.status === 'requested' && <div className="row">
                <button className="btn btn-gold sm" disabled={busy !== ''} onClick={() => void decide(p, 'approved')}>Approve</button>
                <button className="btn btn-line sm" disabled={busy !== ''} onClick={() => void decide(p, 'rejected')}>Reject</button>
              </div>}
              {p.status === 'approved' && <div className="payout-settle">
                <label className="field"><span>Transfer reference</span><input value={references[p.id] ?? ''} maxLength={100} onChange={e => setReferences(r => ({ ...r, [p.id]: e.target.value }))} /></label>
                <button className="btn btn-gold sm" disabled={busy !== '' || (references[p.id]?.trim().length ?? 0) < 4} onClick={() => void decide(p, 'paid')}>Record paid</button>
              </div>}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
