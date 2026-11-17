import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import BirthForm from '../components/BirthForm'
import { useAuth } from '../context/AuthContext'
import { usePrefs } from '../context/PrefsContext'
import { api } from '../services/api'
import type { BirthProfile, Gender, Language, ThemeMode } from '../types'
import { errorText, fieldErrors } from '../utils'
import './profile-settings.css'

/* ---------- reusable section card ---------- */
function Section({ id, icon, title, hint, action, tone, children }: {
  id: string; icon: string; title: string; hint?: string; action?: ReactNode; tone?: 'danger'; children: ReactNode
}) {
  return (
    <section id={id} className={'ps-card' + (tone ? ' ' + tone : '')} aria-labelledby={id + '-h'}>
      <header className="ps-card-head">
        <span className="ps-ico" aria-hidden="true">{icon}</span>
        <div className="ps-card-title">
          <h2 id={id + '-h'}>{title}</h2>
          {hint && <p>{hint}</p>}
        </div>
        {action}
      </header>
      <div className="ps-card-body">{children}</div>
    </section>
  )
}

/* ---------- your details ---------- */
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
    <Section id="ps-details" icon="👤" title={t('profile.details')}>
      <form className="ps-form" onSubmit={save} noValidate>
        <div className="ps-grid">
          <div className="field"><label htmlFor="pf-name">{t('profile.name')}</label>
            <input id="pf-name" value={name} onChange={e => setName(e.target.value)} maxLength={80} autoComplete="name" aria-invalid={!!fe.name} />
            {fe.name && <p className="err">{fe.name}</p>}</div>
          <div className="field"><label htmlFor="pf-gender">{t('profile.gender')}</label>
            <select id="pf-gender" value={gender} onChange={e => setGender(e.target.value as Gender | '')}>
              <option value="">{t('gender.select')}</option>
              <option value="male">{t('gender.male')}</option><option value="female">{t('gender.female')}</option><option value="other">{t('gender.other')}</option>
            </select></div>
          <div className="field"><label htmlFor="pf-phone">{t('profile.phone')}</label>
            <div className="ps-lock"><input id="pf-phone" value={user?.phone ?? ''} disabled /><span aria-hidden="true">🔒</span></div></div>
          <div className="field"><label htmlFor="pf-email">{t('profile.email')}</label>
            <input id="pf-email" type="email" value={email} onChange={e => setEmail(e.target.value)} maxLength={120} autoComplete="email" aria-invalid={!!fe.email} />
            {fe.email && <p className="err">{fe.email}</p>}</div>
        </div>
        {err && <p className="alert" role="alert">{err}</p>}
        <div className="ps-actions">
          <button className="btn btn-gold" type="submit" disabled={busy}>{busy ? t('profile.saving') : t('profile.save')}</button>
          {msg && <span className="ps-saved" role="status">✓ {msg}</span>}
        </div>
      </form>
    </Section>
  )
}

/* ---------- preferences ---------- */
const THEME_ICON: Record<ThemeMode, string> = { light: '☀️', dark: '🌙', auto: '🖥️' }

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
    <Section id="ps-prefs" icon="🎨" title={t('profile.prefs')}>
      <fieldset className="ps-fs"><legend>{t('profile.theme')}</legend>
        <div className="ps-themes">
          {(['light', 'dark', 'auto'] as const).map(v => (
            <label key={v} className={'ps-theme ' + v + (theme === v ? ' sel' : '')}>
              <input type="radio" name="theme" checked={theme === v} onChange={() => pickTheme(v)} />
              <span className="ps-theme-prev" aria-hidden="true"><i /><i /><i /></span>
              <span className="ps-theme-name"><span aria-hidden="true">{THEME_ICON[v]}</span> {t('theme.' + v)}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="ps-fs"><legend>{t('profile.language')}</legend>
        <div className="ps-seg">
          {(['en', 'hi'] as const).map(v => (
            <label key={v} className={lang === v ? 'sel' : ''}><input type="radio" name="lang" checked={lang === v} onChange={() => pickLang(v)} />{t('lang.' + v)}</label>
          ))}
        </div>
      </fieldset>
      {err && <p className="alert" role="alert">{err}</p>}
    </Section>
  )
}

/* ---------- birth profiles ---------- */
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
    <Section
      id="ps-birth" icon="✦" title={t('profile.birth')} hint={t('profile.birthHelp')}
      action={editing === null ? <button className="btn btn-gold sm" onClick={() => setEditing('new')}>＋ {t('birth.add')}</button> : undefined}
    >
      {err && <p className="alert" role="alert">{err}</p>}
      {editing !== null && (
        <div className="ps-formwrap">
          <BirthForm key={editing === 'new' ? 'new' : editing.id} initial={editing === 'new' ? undefined : editing}
            defaultName={editing === 'new' && items?.length === 0 ? user?.name : ''}
            onSaved={() => { setEditing(null); void load() }} onCancel={() => setEditing(null)} />
        </div>
      )}
      {items === null && !err && <p className="muted">{t('common.loading')}</p>}
      {items?.length === 0 && editing === null && (
        <div className="ps-empty"><span aria-hidden="true">✦</span><p>{t('birth.empty')}</p></div>
      )}
      <ul className="ps-bp">
        {items?.map(p => (
          <li key={p.id} className={'ps-bp-row' + (p.isPrimary ? ' primary' : '')}>
            <span className="ps-bp-av" aria-hidden="true">{p.name.trim().charAt(0).toUpperCase()}</span>
            <div className="ps-bp-info">
              <b>{p.name}{p.isPrimary && <span className="ps-badge">★ {t('birth.primary')}</span>}</b>
              <div className="ps-meta">
                <span>📅 {p.birthDate}</span>
                <span>🕐 {p.birthTime ?? t('birth.timeUnknown')}</span>
                <span>📍 {p.birthPlace}</span>
              </div>
            </div>
            <div className="ps-bp-act">
              {!p.isPrimary && <button className="ps-mini" onClick={() => makePrimary(p)}>{t('birth.setPrimary')}</button>}
              <button className="ps-mini" onClick={() => setEditing(p)}>{t('birth.edit')}</button>
              <button className="ps-mini danger" onClick={() => remove(p)}>{t('birth.delete')}</button>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  )
}

/* ---------- your data ---------- */
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
    <Section id="ps-data" icon="🛡️" title={t('data.title')}>
      <div className="ps-data-row">
        <span className="ps-data-ico" aria-hidden="true">⬇</span>
        <div className="ps-data-txt"><b>{t('data.export')}</b></div>
        <button className="btn btn-line sm" onClick={download}>{t('data.export')}</button>
      </div>

      <div className="ps-danger">
        <h3>⚠ {t('data.delete')}</h3>
        <p>{t('data.deleteHelp')}</p>
        <div className="ps-danger-row">
          <input aria-label="DELETE" value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder="DELETE" autoComplete="off" />
          <button className="btn btn-danger sm" disabled={confirmText !== 'DELETE' || busy} onClick={remove}>{t('data.deleteConfirm')}</button>
        </div>
      </div>
      {err && <p className="alert" role="alert">{err}</p>}
    </Section>
  )
}

/* ---------- page ---------- */
export default function ProfileSettings() {
  const { t } = usePrefs()
  const { user } = useAuth()
  const [active, setActive] = useState('ps-details')

  const nav = [
    { id: 'ps-details', icon: '👤', label: t('profile.details') },
    { id: 'ps-prefs', icon: '🎨', label: t('profile.prefs') },
    { id: 'ps-birth', icon: '✦', label: t('profile.birth') },
    { id: 'ps-data', icon: '🛡️', label: t('data.title') },
  ]

  // highlight the section that is currently on screen
  useEffect(() => {
    const els = nav.map(n => document.getElementById(n.id)).filter((x): x is HTMLElement => !!x)
    if (!('IntersectionObserver' in window)) return
    const io = new IntersectionObserver(entries => {
      const vis = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
      if (vis) setActive(vis.target.id)
    }, { rootMargin: '-20% 0px -65% 0px' })
    els.forEach(el => io.observe(el))
    return () => io.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const go = (id: string) => {
    setActive(id)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const initial = (user?.name || user?.phone || '?').trim().charAt(0).toUpperCase()

  return (
    <section className="wrap sec ps">
      {/* hero */}
      <div className="ps-hero">
        <div className="ps-hero-av">
          {user?.photoUrl ? <img src={user.photoUrl} alt="" /> : <span aria-hidden="true">{initial}</span>}
        </div>
        <div className="ps-hero-txt">
          <h1>{t('profile.title')}</h1>
          <p className="ps-hero-name">{user?.name || '—'}</p>
          <div className="ps-hero-chips">
            {user?.phone && <span>📱 {user.phone}</span>}
            {user?.email && <span>✉️ {user.email}</span>}
          </div>
        </div>
      </div>

      <div className="ps-layout">
        <nav className="ps-nav" aria-label={t('profile.title')}>
          {nav.map(n => (
            <button key={n.id} type="button" className={active === n.id ? 'on' : ''} aria-current={active === n.id ? 'true' : undefined} onClick={() => go(n.id)}>
              <span aria-hidden="true">{n.icon}</span>{n.label}
            </button>
          ))}
        </nav>

        <div className="ps-stack">
          <Details />
          <Prefs />
          <BirthProfiles />
          <YourData />
        </div>
      </div>
    </section>
  )
}