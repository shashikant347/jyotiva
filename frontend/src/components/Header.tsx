import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePrefs } from '../context/PrefsContext'
import { adminLandingPath } from '../adminAccess'
import { ACCOUNT, BRAND, NAV } from '../data'

export default function Header() {
  const [open, setOpen] = useState(false)
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const { pathname } = useLocation()
  const { user, updateUser } = useAuth()
  const { t, lang, setLang, resolvedTheme, setTheme } = usePrefs()
  const close = () => setOpen(false)

  useEffect(() => {
    setOpen(false)
    setActiveMenu(null)
  }, [pathname])

  const isActive = (to: string) => pathname === to || (to !== '/' && pathname.startsWith(`${to}/`))

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
        <Link to="/" className="logo" onClick={close} aria-label={`${BRAND} home`}>
          <span className="logo-mark" aria-hidden="true">
            <svg viewBox="0 0 40 40" role="presentation" focusable="false">
              <defs>
                <linearGradient id="jyotiva-mark-bg" x1="0" y1="0" x2="1" y2="1">
                  <stop stopColor="#33234f" />
                  <stop offset="1" stopColor="#171126" />
                </linearGradient>
                <linearGradient id="jyotiva-mark-gold" x1="0" y1="0" x2="1" y2="1">
                  <stop stopColor="#ffe99a" />
                  <stop offset="1" stopColor="#e5a92c" />
                </linearGradient>
              </defs>
              <rect x="1" y="1" width="38" height="38" rx="13" fill="url(#jyotiva-mark-bg)" />
              <circle cx="20" cy="20" r="13.5" fill="none" stroke="#d8b45d" strokeOpacity=".36" />
              <path d="M20 5.5v3M20 31.5v3M5.5 20h3M31.5 20h3M9.75 9.75l2.1 2.1m16.3 16.3 2.1 2.1m0-20.5-2.1 2.1m-16.3 16.3-2.1 2.1" stroke="#e9c66e" strokeWidth="1.2" strokeLinecap="round" />
              <circle cx="20" cy="20" r="8.5" fill="url(#jyotiva-mark-gold)" />
              <path d="M20 12.5c-1.6 2.3-2.1 4.1-1.3 5.5-2.3-.1-4-1.5-4.9-3.1-.6 3.8 1.5 6.4 4 7.3-.3 1.4.4 3.3 2.2 5.3 1.8-2 2.5-3.9 2.2-5.3 2.5-.9 4.6-3.5 4-7.3-.9 1.6-2.6 3-4.9 3.1.8-1.4.3-3.2-1.3-5.5Z" fill="#38264d" />
              <circle cx="20" cy="21" r="1.25" fill="#fff4cc" />
            </svg>
          </span>
          <span className="logo-word">{BRAND}</span>
        </Link>
        <nav className="nav" aria-label="Main">
          {NAV.map(g => (
            <div className={'dd-wrap' + (activeMenu === g.label ? ' open' : '')} key={g.label}>
              <button
                className={'nav-btn' + (g.items.some(item => isActive(item.to)) ? ' active' : '')}
                aria-haspopup="true"
                aria-expanded={activeMenu === g.label}
                aria-controls={`nav-menu-${g.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                onClick={() => setActiveMenu(current => current === g.label ? null : g.label)}
              >{t(g.key)}</button>
              <div id={`nav-menu-${g.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`} className={'dd' + (g.wide ? ' wide' : '')}>
                {g.items.map(i => <Link key={i.to} to={i.to} aria-current={isActive(i.to) ? 'page' : undefined} onClick={close}>{i.label}</Link>)}
              </div>
            </div>
          ))}
          <Link className={'nav-btn' + (isActive('/astrology-blog') ? ' active' : '')} to="/astrology-blog" aria-current={isActive('/astrology-blog') ? 'page' : undefined}>{t('nav.blog')}</Link>
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
                {user.role === 'admin' && <Link to={adminLandingPath(user)}>Admin tools</Link>}
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
              {user.role === 'admin' && <Link to={adminLandingPath(user)} onClick={close}>Admin tools</Link>}
              {ACCOUNT.map(i => <Link key={i.to} to={i.to} onClick={close}>{t(i.key!)}</Link>)}
              <Link to="/logout" onClick={close}>{t('acct.logout')}</Link>
            </details>
          )}
        </div>
      )}
    </header>
  )
}
