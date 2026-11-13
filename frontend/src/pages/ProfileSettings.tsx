import { useCallback, useEffect, useState, type FormEvent } from 'react'
import BirthForm from '../components/BirthForm'
import { useAuth } from '../context/AuthContext'
import { usePrefs } from '../context/PrefsContext'
import { api } from '../services/api'
import type { BirthProfile, Gender, Language, ThemeMode } from '../types'
import { errorText, fieldErrors } from '../utils'

function Details() {
  const { user, updateUser } = useAuth()
  const { t } = usePrefs()
  const [name, setName] = useState(user?.name ?? '')
  const [gender, setGender] = useState<Gender | ''>(user?.gender ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [fe, setFe] = useState<Record<string, string>>({})

  async function save(e: FormEvent) {
    e.preventDefault()
    setErr(''); setMsg(''); setFe({}); setBusy(true)
    try {
      await updateUser({ name, gender: gender || null, email: email.trim() === '' ? null : email })
      setMsg(t('profile.saved'))
    } catch (x) {
      const f = fieldErrors(x)
      setFe(f)
      if (!Object.keys(f).length) setErr(errorText(x, t))
    } finally { setBusy(false) }
  }

  return (
    <form className="form panel" onSubmit={save} noValidate>
      <h2>{t('profile.details')}</h2>
      <div className="field"><label htmlFor="pf-phone">{t('profile.phone')}</label><input id="pf-phone" value={user?.phone ?? ''} disabled /></div>
      <div className="field"><label htmlFor="pf-name">{t('profile.name')}</label>
        <input id="pf-name" value={name} onChange={e => setName(e.target.value)} maxLength={80} autoComplete="name" aria-invalid={!!fe.name} />
        {fe.name && <p className="err">{fe.name}</p>}</div>
      <div className="field"><label htmlFor="pf-gender">{t('profile.gender')}</label>
        <select id="pf-gender" value={gender} onChange={e => setGender(e.target.value as Gender | '')}>
          <option value="">{t('gender.select')}</option>
          <option value="male">{t('gender.male')}</option><option value="female">{t('gender.female')}</option><option value="other">{t('gender.other')}</option>
        </select></div>
      <div className="field"><label htmlFor="pf-email">{t('profile.email')}</label>
        <input id="pf-email" type="email" value={email} onChange={e => setEmail(e.target.value)} maxLength={120} autoComplete="email" aria-invalid={!!fe.email} />
        {fe.email && <p className="err">{fe.email}</p>}</div>
      {err && <p className="alert" role="alert">{err}</p>}
      {msg && <p className="notice" role="status">{msg}</p>}
      <div><button className="btn btn-gold sm" type="submit" disabled={busy}>{busy ? t('profile.saving') : t('profile.save')}</button></div>
    </form>
  )
}

function Prefs() {
  const { user, updateUser } = useAuth()
  const { t, theme, lang, setTheme, setLang } = usePrefs()
  const [err, setErr] = useState('')

  const push = (patch: { theme?: ThemeMode; language?: Language }) => {
    setErr('')
    updateUser(patch).catch(x => setErr(errorText(x, t)))
  }
  const pickTheme = (v: ThemeMode) => { setTheme(v); if (user) push({ theme: v }) }
  const pickLang = (v: Language) => { setLang(v); if (user) push({ language: v }) }

  return (
    <div className="panel">
      <h2>{t('profile.prefs')}</h2>
      <fieldset className="seg"><legend>{t('profile.theme')}</legend>
        {(['light', 'dark', 'auto'] as const).map(v => (
          <label key={v} className={theme === v ? 'sel' : ''}><input type="radio" name="theme" checked={theme === v} onChange={() => pickTheme(v)} />{t('theme.' + v)}</label>
        ))}
      </fieldset>
      <fieldset className="seg"><legend>{t('profile.language')}</legend>
        {(['en', 'hi'] as const).map(v => (
          <label key={v} className={lang === v ? 'sel' : ''}><input type="radio" name="lang" checked={lang === v} onChange={() => pickLang(v)} />{t('lang.' + v)}</label>
        ))}
      </fieldset>
      {err && <p className="alert" role="alert">{err}</p>}
    </div>
  )
}

function BirthProfiles() {
  const { user } = useAuth()
  const { t } = usePrefs()
  const [items, setItems] = useState<BirthProfile[] | null>(null)
  const [editing, setEditing] = useState<BirthProfile | 'new' | null>(null)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    try { setItems(await api<BirthProfile[]>('/me/birth-profiles')) } catch (x) { setErr(errorText(x, t)) }
  }, [t])
  useEffect(() => { void load() }, [load])

  async function act(fn: () => Promise<unknown>) {
    setErr('')
    try { await fn(); await load() } catch (x) { setErr(errorText(x, t)) }
  }
  const remove = (p: BirthProfile) => { if (window.confirm(t('birth.confirmDelete'))) void act(() => api(`/me/birth-profiles/${p.id}`, { method: 'DELETE' })) }
  const makePrimary = (p: BirthProfile) => void act(() => api(`/me/birth-profiles/${p.id}`, { method: 'PATCH', body: { isPrimary: true } }))

  return (
    <div className="panel">
      <div className="sec-h"><h2>{t('profile.birth')}</h2>
        {editing === null && <button className="btn btn-gold sm" onClick={() => setEditing('new')}>{t('birth.add')}</button>}</div>
      <p className="muted small">{t('profile.birthHelp')}</p>
      {err && <p className="alert" role="alert">{err}</p>}
      {editing !== null && (
        <BirthForm key={editing === 'new' ? 'new' : editing.id} initial={editing === 'new' ? undefined : editing}
          defaultName={editing === 'new' && items?.length === 0 ? user?.name : ''}
          onSaved={() => { setEditing(null); void load() }} onCancel={() => setEditing(null)} />
      )}
      {items === null && !err && <p className="muted">{t('common.loading')}</p>}
      {items?.length === 0 && editing === null && <p className="empty">{t('birth.empty')}</p>}
      <ul className="bp-list">
        {items?.map(p => (
          <li key={p.id} className="bp-row">
            <div>
              <b>{p.name}</b>{p.isPrimary && <span className="badge">{t('birth.primary')}</span>}
              <p className="muted small">{p.birthDate} · {p.birthTime ?? t('birth.timeUnknown')} · {p.birthPlace}</p>
            </div>
            <div className="row">
              {!p.isPrimary && <button className="linkish" onClick={() => makePrimary(p)}>{t('birth.setPrimary')}</button>}
              <button className="linkish" onClick={() => setEditing(p)}>{t('birth.edit')}</button>
              <button className="linkish danger" onClick={() => remove(p)}>{t('birth.delete')}</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function YourData() {
  const { logout } = useAuth()
  const { t } = usePrefs()
  const [confirmText, setConfirmText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function download() {
    setErr('')
    try {
      const data = await api<unknown>('/me/export')
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
      const a = document.createElement('a')
      a.href = url
      a.download = 'jyotiva-my-data.json'
      a.click()
      URL.revokeObjectURL(url)
    } catch (x) { setErr(errorText(x, t)) }
  }

  async function remove() {
    setErr(''); setBusy(true)
    try {
      await api('/me', { method: 'DELETE' })
      await logout()
    } catch (x) { setErr(errorText(x, t)); setBusy(false) }
  }

  return (
    <div className="panel">
      <h2>{t('data.title')}</h2>
      <div><button className="btn btn-line sm" onClick={download}>{t('data.export')}</button></div>
      <h3 className="danger-h">{t('data.delete')}</h3>
      <p className="muted small">{t('data.deleteHelp')}</p>
      <div className="row">
        <input aria-label="DELETE" value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder="DELETE" autoComplete="off" />
        <button className="btn btn-danger sm" disabled={confirmText !== 'DELETE' || busy} onClick={remove}>{t('data.deleteConfirm')}</button>
      </div>
      {err && <p className="alert" role="alert">{err}</p>}
    </div>
  )
}

export default function ProfileSettings() {
  const { t } = usePrefs()
  return (
    <section className="wrap sec settings">
      <h1 className="page-h">{t('profile.title')}</h1>
      <Details />
      <Prefs />
      <BirthProfiles />
      <YourData />
    </section>
  )
}
