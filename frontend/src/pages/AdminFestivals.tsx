import { useEffect, useState, type FormEvent } from 'react'
import { hasAdminAccess } from '../adminAccess'
import { useAuth } from '../context/AuthContext'
import { usePageMeta } from '../hooks'
import { api, isApiError } from '../services/api'

interface Festival { id: string; slug: string; title: string; date: string; region: string; language: 'en' | 'hi'; tithi: string; paksha: string; description: string; status: 'draft' | 'published' }
type Form = Omit<Festival, 'id' | 'slug' | 'status'> & { slug: string; status: Festival['status'] }
const blank = (): Form => ({ title: '', slug: '', date: '', region: 'India', language: 'en', tithi: '', paksha: '', description: '', status: 'draft' })

export default function AdminFestivals() {
  usePageMeta('Admin: festival calendar', { noindex: true })
  const { user } = useAuth()
  const [rows, setRows] = useState<Festival[]>([])
  const [form, setForm] = useState<Form>(blank())
  const [editing, setEditing] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  async function load() { try { setRows((await api<{ items: Festival[] }>('/admin/festivals')).items) } catch (e) { setMessage(isApiError(e) ? e.message : 'Could not load festival entries.') } }
  useEffect(() => { void load() }, [])
  if (!hasAdminAccess(user, ['content'])) return <section className="wrap sec"><h1 className="page-h">Not allowed</h1></section>
  const set = (p: Partial<Form>) => setForm(x => ({ ...x, ...p }))
  function edit(r: Festival) { setEditing(r.id); setForm({ title: r.title, slug: r.slug, date: r.date, region: r.region, language: r.language, tithi: r.tithi, paksha: r.paksha, description: r.description, status: r.status }); setMessage('') }
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMessage('')
    try {
      await api(editing ? `/admin/festivals/${editing}` : '/admin/festivals', { method: editing ? 'PATCH' : 'POST', body: form })
      setMessage(editing ? 'Festival updated.' : 'Festival saved.'); setForm(blank()); setEditing(null); await load()
    } catch (e) { setMessage(isApiError(e) ? e.message : 'Could not save the festival.') }
    finally { setBusy(false) }
  }
  async function remove(r: Festival) {
    if (!window.confirm(`Delete ${r.title}?`)) return
    try { await api(`/admin/festivals/${r.id}`, { method: 'DELETE' }); setMessage('Festival deleted.'); await load() }
    catch (e) { setMessage(isApiError(e) ? e.message : 'Could not delete the festival.') }
  }
  return <section className="wrap sec settings"><h1 className="page-h">Festival calendar</h1><p className="lead">Enter dates from a verified regional almanac. Do not publish a date until its region and observance have been checked.</p>
    <form className="panel form" onSubmit={submit}>
      <h2>{editing ? 'Edit entry' : 'Add festival'}</h2>
      <div className="row2"><div className="field"><label htmlFor="f-title">Festival name</label><input id="f-title" value={form.title} onChange={e => set({ title: e.target.value })} required maxLength={120} /></div><div className="field"><label htmlFor="f-slug">Slug (optional)</label><input id="f-slug" value={form.slug} onChange={e => set({ slug: e.target.value })} maxLength={90} /></div></div>
      <div className="row2"><div className="field"><label htmlFor="f-date">Date</label><input id="f-date" type="date" value={form.date} onChange={e => set({ date: e.target.value })} required min="2000-01-01" max="2100-12-31" /></div><div className="field"><label htmlFor="f-region">Region</label><input id="f-region" value={form.region} onChange={e => set({ region: e.target.value })} required maxLength={80} /></div></div>
      <div className="row2"><div className="field"><label htmlFor="f-lang">Language</label><select id="f-lang" value={form.language} onChange={e => set({ language: e.target.value as Form['language'] })}><option value="en">English</option><option value="hi">Hindi</option></select></div><div className="field"><label htmlFor="f-status">Status</label><select id="f-status" value={form.status} onChange={e => set({ status: e.target.value as Form['status'] })}><option value="draft">Draft</option><option value="published">Published</option></select></div></div>
      <div className="row2"><div className="field"><label htmlFor="f-paksha">Paksha</label><input id="f-paksha" value={form.paksha} onChange={e => set({ paksha: e.target.value })} maxLength={40} /></div><div className="field"><label htmlFor="f-tithi">Tithi</label><input id="f-tithi" value={form.tithi} onChange={e => set({ tithi: e.target.value })} maxLength={80} /></div></div>
      <div className="field"><label htmlFor="f-description">Details</label><textarea id="f-description" rows={5} value={form.description} onChange={e => set({ description: e.target.value })} required minLength={10} maxLength={4000} /></div>
      {message && <p className="notice" role="status">{message}</p>}<div className="row"><button className="btn btn-gold" disabled={busy}>{busy ? 'Saving…' : editing ? 'Update festival' : 'Save festival'}</button>{editing && <button type="button" className="btn btn-line" onClick={() => { setEditing(null); setForm(blank()) }}>Cancel</button>}</div>
    </form>
    <div className="panel form"><h2>All entries</h2>{rows.map(r => <div className="trow" key={r.id}><span><b>{r.title}</b><br /><span className="muted small">{r.date} · {r.region} · {r.language} · {r.status}</span></span><span className="row"><button type="button" className="btn btn-line sm" onClick={() => edit(r)}>Edit</button><button type="button" className="btn btn-line sm" onClick={() => void remove(r)}>Delete</button></span></div>)}{!rows.length && <p className="empty">No festival entries yet.</p>}</div>
  </section>
}
