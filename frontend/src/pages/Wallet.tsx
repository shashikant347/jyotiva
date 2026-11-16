import { useCallback, useEffect, useState } from 'react'
import { BRAND } from '../data'
import { usePrefs } from '../context/PrefsContext'
import { usePageMeta } from '../hooks'
import { api, isApiError } from '../services/api'

interface Info { balancePaise: number; gateway: { mode: 'razorpay' | 'mock' | 'unavailable'; keyId: string | null }; limits: { minPaise: number; maxPaise: number }; presetsPaise: number[] }
interface Tx { id: string; type: string; amountPaise: number; balanceAfterPaise: number; note: string; createdAt: string }
interface Order { paymentId: string; orderId: string; amountPaise: number; bonusPaise: number; provider: 'razorpay' | 'mock'; keyId: string | null }

const rs = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: paise % 100 ? 2 : 0, maximumFractionDigits: 2 })}`
const LABEL: Record<string, string> = { recharge: 'Added money', bonus: 'Bonus', debit: 'Consultation', refund: 'Refund', adjustment: 'Adjustment' }

declare global { interface Window { Razorpay?: new (o: Record<string, unknown>) => { open: () => void } } }
function loadRazorpay(): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true)
  return new Promise(res => {
    const s = document.createElement('script')
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    s.onload = () => res(true); s.onerror = () => res(false)
    document.head.appendChild(s)
  })
}

export default function Wallet() {
  const { t } = usePrefs()
  usePageMeta('My wallet', { noindex: true })
  const [info, setInfo] = useState<Info | null>(null)
  const [txs, setTxs] = useState<Tx[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [amount, setAmount] = useState('')
  const [coupon, setCoupon] = useState('')
  const [bonus, setBonus] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const load = useCallback(async (p = 1) => {
    try {
      const [w, h] = await Promise.all([api<Info>('/wallet'), api<{ total: number; items: Tx[] }>(`/wallet/transactions?page=${p}`)])
      setInfo(w); setTxs(h.items); setTotal(h.total); setPage(p)
    } catch (e) { setMsg({ kind: 'err', text: isApiError(e) ? e.message : 'Could not load your wallet' }) }
  }, [])
  useEffect(() => { void load() }, [load])

  const amountPaise = Math.round(Number(amount) * 100)
  const valid = info && Number.isFinite(amountPaise) && amountPaise >= info.limits.minPaise && amountPaise <= info.limits.maxPaise && Number.isInteger(Number(amount))

  async function applyCoupon() {
    setMsg(null); setBonus(null)
    if (!valid || !coupon.trim()) { setMsg({ kind: 'err', text: 'Enter an amount first, then the coupon code' }); return }
    try { const r = await api<{ bonusPaise: number }>('/coupons/apply', { method: 'POST', body: { code: coupon, amountPaise } }); setBonus(r.bonusPaise) }
    catch (e) { setMsg({ kind: 'err', text: isApiError(e) ? e.message : 'Could not check the coupon' }) }
  }

  async function recharge() {
    if (!info || !valid) return
    setBusy(true); setMsg(null)
    try {
      const o = await api<Order>('/wallet/recharge', { method: 'POST', body: { amountPaise, ...(coupon.trim() ? { couponCode: coupon.trim() } : {}) } })
      if (o.provider === 'mock') {
        await api('/wallet/recharge/mock-pay', { method: 'POST', body: { paymentId: o.paymentId } })
        setMsg({ kind: 'ok', text: `Test mode: ${rs(o.amountPaise + o.bonusPaise)} added. No real money was used.` })
        setAmount(''); setCoupon(''); setBonus(null); await load(); return
      }
      if (!(await loadRazorpay()) || !window.Razorpay) throw new Error('Could not load the payment window. Check your connection and try again.')
      new window.Razorpay({
        key: o.keyId, order_id: o.orderId, amount: o.amountPaise, currency: 'INR', name: BRAND, description: 'Wallet recharge',
        handler: async (r: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          try {
            await api('/wallet/recharge/confirm', { method: 'POST', body: { paymentId: o.paymentId, razorpayOrderId: r.razorpay_order_id, razorpayPaymentId: r.razorpay_payment_id, razorpaySignature: r.razorpay_signature } })
            setMsg({ kind: 'ok', text: 'Payment received. Your wallet has been updated.' })
          } catch {
            setMsg({ kind: 'ok', text: 'We received your payment and are confirming it. If your balance does not update in a few minutes, contact support with your payment ID: ' + r.razorpay_payment_id })
          }
          setAmount(''); setCoupon(''); setBonus(null); await load()
        },
        modal: { ondismiss: () => setBusy(false) },
      }).open()
    } catch (e) { setMsg({ kind: 'err', text: isApiError(e) ? e.message : e instanceof Error ? e.message : 'Something went wrong' }) }
    finally { setBusy(false) }
  }

  return (
    <section className="wrap sec settings">
      <h1 className="page-h">{t('acct.wallet')}</h1>
      <div className="panel">
        <small className="muted">{t('wallet.balance')}</small>
        <p className="balance">{info ? rs(info.balancePaise) : '…'}</p>
        {info?.gateway.mode === 'mock' && <p className="notice">Test mode: payments are simulated and no real money is charged.</p>}
        {info?.gateway.mode === 'unavailable' && <p className="alert">Payments are not available right now.</p>}
      </div>

      {info && info.gateway.mode !== 'unavailable' && (
        <div className="panel form">
          <h2>{t('wallet.recharge')}</h2>
          <div className="row">{info.presetsPaise.map(p => <button key={p} type="button" className={'btn sm ' + (amountPaise === p ? 'btn-gold' : 'btn-line')} onClick={() => { setAmount(String(p / 100)); setBonus(null) }}>{rs(p)}</button>)}</div>
          <div className="field"><label htmlFor="amt">Amount (₹)</label><input id="amt" inputMode="numeric" value={amount} onChange={e => { setAmount(e.target.value.replace(/\D/g, '')); setBonus(null) }} placeholder={`${info.limits.minPaise / 100} to ${info.limits.maxPaise / 100}`} /></div>
          <div className="field"><label htmlFor="cpn">Coupon code (optional)</label>
            <div className="row"><input id="cpn" value={coupon} maxLength={30} onChange={e => { setCoupon(e.target.value); setBonus(null) }} /><button type="button" className="btn btn-line" onClick={applyCoupon}>Check</button></div>
            {bonus !== null && <p className="notice">Coupon accepted: you will get {rs(bonus)} extra after payment.</p>}
          </div>
          {msg && <p className={msg.kind === 'err' ? 'alert' : 'notice'} role={msg.kind === 'err' ? 'alert' : 'status'}>{msg.text}</p>}
          <button className="btn btn-gold" disabled={!valid || busy} onClick={recharge}>{busy ? 'Please wait…' : valid ? `Add ${rs(amountPaise)}` : 'Add money'}</button>
          <p className="muted small">Wallet money is used for consultations. See the <a href="/refund-and-cancellation-policy">refund policy</a>. Card details are handled by the payment provider and never reach our servers.</p>
        </div>
      )}
      {!info && msg && <p className="alert" role="alert">{msg.text}</p>}

      <div className="panel">
        <h2>{t('wallet.history')}</h2>
        {txs.length === 0 ? <p className="empty">{t('empty.transactions')}</p> : (
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>Date</th><th>Details</th><th>Amount</th><th>Balance</th></tr></thead>
            <tbody>{txs.map(x => (
              <tr key={x.id}><td>{new Date(x.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td><td>{LABEL[x.type] ?? x.type}<br /><span className="muted small">{x.note}</span></td>
                <td className={x.amountPaise < 0 ? 'neg' : 'pos'}>{x.amountPaise < 0 ? '−' : '+'}{rs(Math.abs(x.amountPaise))}</td><td>{rs(x.balanceAfterPaise)}</td></tr>
            ))}</tbody></table></div>
        )}
        {total > 20 && <div className="row pager-row"><button className="btn btn-line" disabled={page <= 1} onClick={() => load(page - 1)}>Previous</button><span className="muted">Page {page} of {Math.ceil(total / 20)}</span><button className="btn btn-line" disabled={page >= Math.ceil(total / 20)} onClick={() => load(page + 1)}>Next</button></div>}
      </div>
    </section>
  )
}
