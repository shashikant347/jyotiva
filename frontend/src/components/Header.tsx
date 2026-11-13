import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePrefs } from '../context/PrefsContext'
import { ACCOUNT, BRAND, NAV } from '../data'

export default function Header() {
  const [open, setOpen] = useState(false)
  const { user, updateUser } = useAuth()
  const { t, lang, setLang, resolvedTheme, setTheme } = usePrefs()
  const close = () => setOpen(false)

  const toggleTheme = () => {
    const next = resolvedTheme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    if (user) updateUser({ theme: next }).catch(() => { /* local choice still applies */ })
  }
  const toggleLang = () => {
    const next = lang === 'en' ? 'hi' : 'en'
    setLang(next)
    if (user) updateUser({ language: next }).catch(() => { /* local choice still applies */ })
  }
  const initial = (user?.name || user?.phone || '?').replace('+', '').trim()[0]?.toUpperCase() ?? '?'

  return (
    <header className="hdr">
      <div className="wrap hdr-in">
        <Link to="/" className="logo" onClick={close}><span className="logo-mark" aria-hidden>☉</span>{BRAND}</Link>
        <nav className="nav" aria-label="Main">
          {NAV.map(g => (
            <div className="dd-wrap" key={g.label}>
              <button className="nav-btn" aria-haspopup="true">{t(g.key)}</button>
              <div className={'dd' + (g.wide ? ' wide' : '')}>{g.items.map(i => <Link key={i.to} to={i.to}>{i.label}</Link>)}</div>
            </div>
          ))}
          <Link className="nav-btn" to="/astrology-blog">{t('nav.blog')}</Link>
        </nav>
        <div className="hdr-actions">
          <button className="icon-btn" onClick={toggleLang} aria-label={t('hdr.language')} lang={lang === 'en' ? 'hi' : 'en'}>{lang === 'en' ? 'हि' : 'EN'}</button>
          <button className="icon-btn" onClick={toggleTheme} aria-label={t('hdr.theme')}>{resolvedTheme === 'dark' ? '☀' : '☾'}</button>
          <Link to="/chat-with-astrologer" className="btn btn-gold hide-sm">{t('hdr.talkNow')}</Link>
          {user ? (
            <div className="dd-wrap hide-sm">
              <button className="icon-btn avatar-btn" aria-haspopup="true" aria-label={t('hdr.account')}>{initial}</button>
              <div className="dd right">
                <div className="dd-head"><b>{user.name || t('acct.guest')}</b><span className="muted small">{user.phone}</span></div>
                {ACCOUNT.map(i => <Link key={i.to} to={i.to}>{t(i.key!)}</Link>)}
                <Link to="/logout">{t('acct.logout')}</Link>
              </div>
            </div>
          ) : (
            <Link to="/login" className="btn btn-line sm hide-sm">{t('hdr.signIn')}</Link>
          )}
          <button className="icon-btn burger" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-label={t('hdr.menu')}>{open ? '✕' : '☰'}</button>
        </div>
      </div>
      {open && (
        <div className="drawer">
          {!user && <Link to="/login" className="btn btn-gold" onClick={close}>{t('hdr.signInUp')}</Link>}
          {NAV.map(g => (
            <details key={g.label}><summary>{t(g.key)}</summary>{g.items.map(i => <Link key={i.to} to={i.to} onClick={close}>{i.label}</Link>)}</details>
          ))}
          {user && (
            <details open><summary>{user.name || t('acct.guest')}</summary>
              {ACCOUNT.map(i => <Link key={i.to} to={i.to} onClick={close}>{t(i.key!)}</Link>)}
              <Link to="/logout" onClick={close}>{t('acct.logout')}</Link>
            </details>
          )}
        </div>
      )}
    </header>
  )
}
