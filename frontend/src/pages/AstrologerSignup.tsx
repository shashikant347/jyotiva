import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import type { Meta } from '../astrologers/types'
import { usePageMeta } from '../hooks'
import { api, isApiError } from '../services/api'
import { fieldErrors } from '../utils'

const toggle = (list: string[], v: string): string[] => (list.includes(v) ? list.filter(x => x !== v) : [...list, v])

export default function AstrologerSignup() {
  usePageMeta('Astrologer registration', { noindex: true })
  const [meta, setMeta] = useState<Meta | null>(null)
  const [existing, setExisting] = useState<{ applicationStatus: string } | null | undefined>(undefined)
  const [f, setF] = useState({ displayName: '', bio: '', experienceYears: '', gender: '', languages: [] as string[], categories: [] as string[], skills: [] as string[], chatPriceRupees: '', callPriceRupees: '' })
  const [errs, setErrs] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false); const [done, setDone] = useState(false)

  useEffect(() => {
    api<Meta>('/astrologers/categories', { auth: false }).then(setMeta).catch(() => {})
    api<{ application: { applicationStatus: string } | null }>('/astrologers/me/profile').then(r => setExisting(r.application)).catch(() => setExisting(null))
  }, [])

  async function submit(e: FormEvent) {
    e.preventDefault(); setMsg(''); setErrs({})
    const e2: Record<string, string> = {}
    if (f.displayName.trim().length < 2) e2.displayName = 'Enter your public name'
    if (f.bio.trim().length < 20) e2.bio = 'Write at least 20 characters about yourself'
    if (f.experienceYears === '' || Number(f.experienceYears) < 0) e2.experienceYears = 'Enter your years of experience'
    if (!f.gender) e2.gender = 'Choose one'
    if (!f.languages.length) e2.languages = 'Pick at least one language'
    if (!f.categories.length) e2.categories = 'Pick at least one speciality'
    if (!f.skills.length) e2.skills = 'Pick at least one skill'
    const lo = meta?.priceLimits.minRupees ?? 5, hi = meta?.priceLimits.maxRupees ?? 200
    for (const k of ['chatPriceRupees', 'callPriceRupees'] as const) { const n = Number(f[k]); if (!Number.isInteger(n) || n < lo || n > hi) e2[k] = `Enter a whole number from ${lo} to ${hi}` }
    setErrs(e2)
    if (Object.keys(e2).length) return
    setBusy(true)
    try {
      await api('/astrologers/apply', { method: 'POST', body: { displayName: f.displayName.trim(), bio: f.bio.trim(), experienceYears: Number(f.experienceYears), gender: f.gender, languages: f.languages, categories: f.categories, skills: f.skills, chatPriceRupees: Number(f.chatPriceRupees), callPriceRupees: Number(f.callPriceRupees) } })
      setDone(true)
    } catch (x) { setErrs(fieldErrors(x)); setMsg(isApiError(x) ? x.message : 'Something went wrong') } finally { setBusy(false) }
  }

  if (done) return <section className="wrap sec settings"><h1 className="page-h">Application received</h1><p className="lead">Thank you. Our team will review your application. You can check its status on your <Link to="/astrologer-panel">astrologer page</Link>.</p></section>
  if (existing && existing.applicationStatus !== 'rejected') return <section className="wrap sec settings"><h1 className="page-h">Astrologer registration</h1><p className="lead">You already have an application (status: {existing.applicationStatus}). See your <Link to="/astrologer-panel">astrologer page</Link>.</p></section>

  const checks = (key: 'languages' | 'categories' | 'skills', label: string, opts: [string, string][]) => (
    <fieldset className="field"><legend>{label}</legend><div className="chips">{opts.map(([v, l]) => <label key={v} className="check chip"><input type="checkbox" checked={f[key].includes(v)} onChange={() => setF({ ...f, [key]: toggle(f[key], v) })} /> {l}</label>)}</div>{errs[key] && <p className="err">{errs[key]}</p>}</fieldset>
  )
  const txt = (id: keyof typeof f, label: string, type = 'text', extra = {}) => (
    <div className="field"><label htmlFor={id}>{label}</label><input id={id} type={type} value={f[id] as string} aria-invalid={!!errs[id]} onChange={e => setF({ ...f, [id]: e.target.value })} {...extra} />{errs[id] && <p className="err">{errs[id]}</p>}</div>
  )
  return (
    <section className="wrap sec settings">
      <h1 className="page-h">Astrologer registration</h1>
      <p className="lead">Tell us about yourself. Applications are reviewed before a profile goes live. Only claim experience and skills you can stand behind.</p>
      <form className="panel form" onSubmit={submit} noValidate>
        {txt('displayName', 'Public name', 'text', { maxLength: 60 })}
        <div className="field"><label htmlFor="bio">About you</label><textarea id="bio" rows={5} maxLength={1000} value={f.bio} aria-invalid={!!errs.bio} onChange={e => setF({ ...f, bio: e.target.value })} />{errs.bio && <p className="err">{errs.bio}</p>}</div>
        <div className="row2">{txt('experienceYears', 'Years of experience', 'number', { min: 0, max: 70 })}
          <div className="field"><label htmlFor="gender">Gender</label><select id="gender" value={f.gender} onChange={e => setF({ ...f, gender: e.target.value })}><option value="">Choose</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option></select>{errs.gender && <p className="err">{errs.gender}</p>}</div></div>
        {checks('languages', 'Languages you consult in', (meta?.languages ?? []).map(l => [l.code, l.name]))}
        {checks('categories', 'Specialities', (meta?.categories ?? []).map(c => [c.slug, c.name]))}
        {checks('skills', 'Skills', (meta?.skills ?? []).map(s => [s.slug, s.name]))}
        <div className="row2">{txt('chatPriceRupees', 'Chat price (₹ per minute)', 'number', { min: 5, max: 200 })}{txt('callPriceRupees', 'Call price (₹ per minute)', 'number', { min: 5, max: 200 })}</div>
        <p className="muted small">Identity and certificate checks are done by our team during review. Document upload is added in a later phase.</p>
        {msg && <p className="alert" role="alert">{msg}</p>}
        <button className="btn btn-gold" disabled={busy}>{busy ? 'Sending…' : 'Submit application'}</button>
      </form>
    </section>
  )
}
