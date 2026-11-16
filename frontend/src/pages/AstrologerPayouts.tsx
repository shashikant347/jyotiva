import { useEffect, useState, type FormEvent } from 'react'
import { rupees } from '../astrologers/types'
import { api, isApiError } from '../services/api'

interface Payout {
  id: string
  amountPaise: number
  status: 'requested' | 'approved' | 'rejected' | 'paid'
  requestedAt: string
  paidAt: string | null
  reference: string | null
}

interface PayoutSummary {
  totalEarnedPaise: number
  reservedPaise: number
  paidPaise: number
  availablePaise: number
  items: Payout[]
}

export default function AstrologerPayouts() {
  const [data, setData] = useState<PayoutSummary | null>(null)
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function load() {
    setData(await api<PayoutSummary>('/astrologers/me/payouts'))
  }

  useEffect(() => {
    let active = true
    api<PayoutSummary>('/astrologers/me/payouts').then(d => { if (active) setData(d) }).catch(e => { if (active) setError(isApiError(e) ? e.message : 'Could not load earnings.') })
    return () => { active = false }
  }, [])

  async function requestPayout(e: FormEvent) {
    e.preventDefault()
    setError('')
    setMessage('')
    const rupeeAmount = Number(amount)
    if (!Number.isFinite(rupeeAmount) || rupeeAmount <= 0) {
      setError('Enter an amount greater than zero.')
      return
    }
    const amountPaise = Math.round(rupeeAmount * 100)
    setBusy(true)
    try {
      await api('/astrologers/me/payouts', { method: 'POST', body: { amountPaise } })
      setAmount('')
      setMessage('Payout request submitted for review.')
      try { await load() } catch (e) { setError(isApiError(e) ? `Payout requested, but the balance could not refresh: ${e.message}` : 'Payout requested, but the balance could not refresh.') }
    } catch (e) {
      setError(isApiError(e) ? e.message : 'Could not request a payout.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="panel payout-summary">
      <h2>Earnings and payouts</h2>
      {error && <p className="alert" role="alert">{error}</p>}
      {message && <p className="notice" role="status">{message}</p>}
      {!data ? <p className="muted">Loading earnings…</p> : <>
        <div className="summary">
          <div><span className="muted small">Total earned</span><b>{rupees(data.totalEarnedPaise)}</b></div>
          <div><span className="muted small">Reserved</span><b>{rupees(data.reservedPaise)}</b></div>
          <div><span className="muted small">Paid out</span><b>{rupees(data.paidPaise)}</b></div>
          <div><span className="muted small">Available</span><b>{rupees(data.availablePaise)}</b></div>
        </div>
        <form className="row payout-request" onSubmit={requestPayout}>
          <label className="field" htmlFor="payout-amount"><span>Request amount (₹)</span>
            <input id="payout-amount" type="number" min="0.01" step="0.01" max={data.availablePaise / 100} value={amount} onChange={e => setAmount(e.target.value)} disabled={busy || data.availablePaise <= 0} required />
          </label>
          <button className="btn btn-gold" disabled={busy || data.availablePaise <= 0}>{busy ? 'Submitting…' : 'Request payout'}</button>
        </form>
        <p className="muted small">Requests are reviewed by the finance team. Transfers are handled manually; no bank details are collected here.</p>
        {data.items.length > 0 && <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>Requested</th><th>Amount</th><th>Status</th><th>Reference</th></tr></thead>
          <tbody>{data.items.map(p => <tr key={p.id}>
            <td>{new Date(p.requestedAt).toLocaleDateString()}</td>
            <td>{rupees(p.amountPaise)}</td>
            <td>{p.status}{p.paidAt ? ` · ${new Date(p.paidAt).toLocaleDateString()}` : ''}</td>
            <td>{p.reference || '—'}</td>
          </tr>)}</tbody>
        </table></div>}
      </>}
    </div>
  )
}
