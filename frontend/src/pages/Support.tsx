import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { usePageMeta } from '../hooks'
import { api, isApiError } from '../services/api'
import { FAQ } from '../data'

interface Ticket { id: string; category: string; subject: string; status: 'open' | 'pending' | 'resolved'; updatedAt: string; userName?: string; userPhone?: string }
interface Msg { id: string; senderRole: 'user' | 'admin'; body: string; createdAt: string }
export const STATUS_LABEL = { open: 'Waiting for us', pending: 'We replied', resolved: 'Closed' } as const
const CATS: [string, string][] = [['payment', 'Payment or wallet'], ['chat', 'A chat session'], ['astrologer', 'An astrologer'], ['account', 'My account'], ['other', 'Something else']]
const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const msg = (e: unknown) => (isApiError(e) ? e.message : 'Something went wrong')

/** Message thread used by the customer page and by the admin page (base = '/support' or '/admin/support'). */
export function Thread({ base, id, admin = false, onChange }: { base: string; id: string; admin?: boolean; onChange?: () => void }) {
  const [data, setData] = useState<{ ticket: Ticket; messages: Msg[] } | null>(null)
  const [text, setText] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const load = useCallback(() => { api<{ ticket: Ticket; messages: Msg[] }>(`${base}/tickets/${id}`).then(setData).catch(e => setErr(msg(e))) }, [base, id])
  useEffect(() => { setData(null); load() }, [load])
  async function send(e: FormEvent) {
    e.preventDefault(); setErr(''); setBusy(true)
    try { await api(`${base}/tickets/${id}/messages`, { method: 'POST', body: { body: text } }); setText(''); load(); onChange?.() } catch (x) { setErr(msg(x)) } finally { setBusy(false) }
  }
  async function setStatus(status: 'open' | 'resolved') {
    setErr('')
    try { await api(admin ? `${base}/tickets/${id}/status` : `${base}/tickets/${id}/close`, { method: 'POST', body: admin ? { status } : undefined }); load(); onChange?.() } catch (x) { setErr(msg(x)) }
  }
  if (!data) return err ? <p className="alert" role="alert">{err}</p> : <p className="muted">Loading…</p>
  const closed = data.ticket.status === 'resolved'
  return (
    <div className="panel thread">
      <div className="row" style={{ justifyContent: 'space-between' }}><b>{data.ticket.subject}</b><span className={'tstatus ' + data.ticket.status}>{STATUS_LABEL[data.ticket.status]}</span></div>
      <div className="msgs">{data.messages.map(m => <div key={m.id} className={'tmsg ' + (m.senderRole === 'admin' ? 'them' : 'me')}><span className="muted small">{m.senderRole === 'admin' ? 'Support' : admin ? 'Customer' : 'You'} · {when(m.createdAt)}</span><p>{m.body}</p></div>)}</div>
      {err && <p className="alert" role="alert">{err}</p>}
      {!closed || admin ? (
        <form onSubmit={send} className="form">
          <div className="field"><label htmlFor="tm">{admin ? 'Reply' : 'Add a message'}</label><textarea id="tm" rows={3} value={text} maxLength={3000} onChange={e => setText(e.target.value)} required /></div>
          <div className="row"><button className="btn btn-gold" disabled={busy || !text.trim()}>Send</button>
            {admin ? (closed ? <button type="button" className="btn btn-line" onClick={() => setStatus('open')}>Reopen</button> : <button type="button" className="btn btn-line" onClick={() => setStatus('resolved')}>Mark resolved</button>)
              : <button type="button" className="btn btn-line" onClick={() => setStatus('resolved')}>Close ticket</button>}</div>
        </form>
      ) : <p className="muted">This ticket is closed. Open a new one if you still need help.</p>}
    </div>
  )
}

export default function CustomerSupport() {
  usePageMeta('Customer support', { noindex: true })
  const [items, setItems] = useState<Ticket[] | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [form, setForm] = useState({ category: 'payment', subject: '', message: '' })
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const load = useCallback(() => { api<{ items: Ticket[] }>('/support/tickets').then(r => setItems(r.items)).catch(e => { setItems([]); setErr(msg(e)) }) }, [])
  useEffect(load, [load])
  async function create(e: FormEvent) {
    e.preventDefault(); setErr(''); setBusy(true)
    try { const t = await api<Ticket>('/support/tickets', { method: 'POST', body: form }); setForm({ category: 'payment', subject: '', message: '' }); setOpen(t.id); load() } catch (x) { setErr(msg(x)) } finally { setBusy(false) }
  }
  return (
    <section className="wrap sec settings">
      <h1 className="page-h">Customer support</h1>
      <p className="lead">Tell us what went wrong and we will reply here.</p>
      {open && <><button className="btn btn-line sm" onClick={() => setOpen(null)}>Back to my tickets</button><Thread base="/support" id={open} onChange={load} /></>}
      {!open && (
        <>
          <form className="panel form" onSubmit={create}>
            <h2>New ticket</h2>
            <div className="field"><label htmlFor="sc">Topic</label><select id="sc" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{CATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
            <div className="field"><label htmlFor="ss">Subject</label><input id="ss" value={form.subject} maxLength={120} onChange={e => setForm({ ...form, subject: e.target.value })} required /></div>
            <div className="field"><label htmlFor="sm">What happened?</label><textarea id="sm" rows={4} value={form.message} maxLength={3000} onChange={e => setForm({ ...form, message: e.target.value })} required /></div>
            {err && <p className="alert" role="alert">{err}</p>}
            <button className="btn btn-gold" disabled={busy}>Send to support</button>
          </form>
          <div className="panel">
            <h2>My tickets</h2>
            {items === null && <p className="muted">Loading…</p>}
            {items?.length === 0 && <p className="empty">You have no tickets yet.</p>}
            {items?.map(t => <button key={t.id} className="trow" onClick={() => setOpen(t.id)}><span>{t.subject}</span><span className={'tstatus ' + t.status}>{STATUS_LABEL[t.status]}</span></button>)}
          </div>
          <div className="panel"><h2>Common questions</h2>{FAQ.map(([q, a]) => <details className="faq" key={q}><summary>{q}</summary><p>{a}</p></details>)}</div>
        </>
      )}
    </section>
  )
}
