import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePrefs } from '../context/PrefsContext'
import { adminLandingPath } from '../adminAccess'
import { ACCOUNT, BRAND, NAV } from '../data'
import { openSocket } from '../chat/socket'
import type { SessionView } from '../chat/types'
import { api } from '../services/api'
const ACCOUNT_MENU = '__account'

function JyotivaMark() {
  return (
    <span className="logo-mark" aria-hidden="true">
      <svg viewBox="0 0 40 40" focusable="false">
        <defs><linearGradient id="jyotiva-mark-bg" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#49345f" /><stop offset="1" stopColor="#241932" /></linearGradient></defs>
        <rect x="1" y="1" width="38" height="38" rx="13" fill="url(#jyotiva-mark-bg)" />
        <circle cx="20" cy="20" r="14.2" fill="none" stroke="#f5d77e" strokeOpacity=".42" />
        <path d="M20 10.3v2.1m0 15.2v2.1m9.7-9.7h-2.1m-15.2 0h-2.1m16.57-6.87-1.48 1.48m-10.74 10.74-1.48 1.48m13.7 0-1.48-1.48m-10.74-10.74-1.48-1.48" stroke="#f5d77e" strokeWidth="1.35" strokeLinecap="round" />
        <circle cx="20" cy="20" r="5.3" fill="#f5d77e" /><circle cx="20" cy="20" r="2.1" fill="#49345f" />
      </svg>
    </span>
  )
}

function AstrologerPanelLink({ className = '' }: { className?: string }) {
  const { user } = useAuth()
  const [items, setItems] = useState<SessionView[] | null>(null)

  useEffect(() => {
    if (user?.role !== 'astrologer') {
      setItems(null)
      return
    }

    let live = true
    api<{ items: SessionView[] }>('/sessions/incoming')
      .then(result => { if (live) setItems(result.items) })
      .catch(() => { if (live) setItems(null) })

    const socket = openSocket()
    const update = (session: SessionView) => setItems(current => {
      if (!current) return [session]
      return current.some(item => item.id === session.id)
        ? current.map(item => item.id === session.id ? session : item)
        : [session, ...current]
    })
    socket.on('session:requested', update)
    socket.on('session:update', update)
    return () => { live = false; socket.disconnect() }
  }, [user?.id, user?.role])

  const waiting = (items ?? []).filter(item =>
    item.status === 'requested' && Date.parse(item.requestExpiresAt) > Date.now(),
  ).length
  const label = waiting > 0
    ? `Astrologer panel, ${waiting} new chat request${waiting === 1 ? '' : 's'}`
    : 'Astrologer panel'

  return (
    <Link to="/astrologer-panel" className={'astro-panel-link ' + className} aria-label={label}>
      Astrologer panel
      {waiting > 0 && <span className="astro-request-count" aria-hidden="true">{waiting > 9 ? '9+' : waiting}</span>}
      {waiting > 0 && <span className="sr">{waiting} pending chat request{waiting === 1 ? '' : 's'}</span>}
    </Link>
  )
}

export default function Header() {
  const [open, setOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const { pathname } = useLocation()
  const { user, updateUser } = useAuth()
  const { t, lang, setLang, resolvedTheme, setTheme } = usePrefs()
  const closeMenuRef = useRef<HTMLButtonElement>(null)
  const close = () => setOpen(false)

  useEffect(() => {
    setOpen(false)
    setProfileOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    document.body.style.overflow = 'hidden'
    window.requestAnimationFrame(() => closeMenuRef.current?.focus())
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close()
        return
      }
      if (event.key !== 'Tab') return
      const menu = document.getElementById('site-drawer')
      const focusable = menu?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), summary')
      if (!focusable?.length) return
      const first = focusable[0], last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
      previousFocus?.focus()
    }
  }, [open])

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
  const firstName = user?.name.trim().split(/\s+/)[0] || 'Profile'
  const sections = [
    { title: 'Consult', groups: NAV.slice(0, 2) },
    { title: 'Free tools', groups: NAV.slice(2) },
  ]

  return (
    <>
    <header className="hdr">
      <div className="wrap hdr-in">
        <nav className="nav" aria-label="Main">
          <button className={'nav-btn explore-toggle' + (NAV.some(group => group.items.some(item => isActive(item.to))) || isActive('/astrology-blog') ? ' active' : '')} onClick={() => setOpen(true)} aria-expanded={open} aria-controls="site-drawer">
            <span aria-hidden="true">☰</span> 
          </button>
        </nav>
        <Link to="/" className="logo" onClick={close} aria-label={`${BRAND} home`}>
          <JyotivaMark />
          <span className="logo-word">{BRAND}</span>
        </Link>
        <div className="hdr-actions">
          <button className="icon-btn" onClick={toggleLang} aria-label={t('hdr.language')} lang={lang === 'en' ? 'hi' : 'en'}>{lang === 'en' ? 'हि' : 'EN'}</button>
          <button className="icon-btn" onClick={toggleTheme} aria-label={t('hdr.theme')}>{resolvedTheme === 'dark' ? '☀' : '☾'}</button>
          <Link to="/chat-with-astrologer" className="btn btn-gold hide-sm">{t('hdr.talkNow')}</Link>
          {user?.role === 'astrologer' && <AstrologerPanelLink className="hide-sm" />}
          {user ? (
            <div className={'dd-wrap profile-menu hide-sm' + (profileOpen ? ' open' : '')}>
              <button className="profile-trigger" aria-haspopup="true" aria-expanded={profileOpen} aria-controls="account-menu" aria-label={t('hdr.account')} onClick={() => setProfileOpen(value => !value)}>
                <span className="profile-avatar">{user.photoUrl ? <img src={user.photoUrl} alt="" /> : initial}</span>
                <span className="profile-label"><b>{firstName}</b><small>Account</small></span>
                <span className="profile-chevron" aria-hidden="true">⌄</span>
              </button>
              <div className="dd right profile-dropdown" id="account-menu">
                <div className="dd-head"><b>{user.name || t('acct.guest')}</b><span className="muted small">{user.phone}</span></div>
                {user.role === 'admin' && <Link to={adminLandingPath(user)} onClick={() => setProfileOpen(false)}>Admin tools</Link>}
                {user.role !== 'astrologer' && <AstrologerPanelLink />}
                {ACCOUNT.map(item => <Link key={item.to} to={item.to} onClick={() => setProfileOpen(false)}>{t(item.key!)}</Link>)}
                <Link to="/logout" onClick={() => setProfileOpen(false)}>{t('acct.logout')}</Link>
              </div>
            </div>
          ) : <Link to="/login" className="btn btn-line sm hide-sm">{t('hdr.signIn')}</Link>}
        </div>
      </div>
    </header>
    {open && createPortal(
      <>
        <button className="drawer-backdrop" onClick={close} aria-label="Close menu" tabIndex={-1} />
        <aside className="drawer" id="site-drawer" role="dialog" aria-modal="true" aria-label="Explore Jyotiva">
          <div className="drawer-head">
            <Link to="/" className="logo" onClick={close} aria-label={`${BRAND} home`}>
              <JyotivaMark /><span className="logo-word">{BRAND}</span>
            </Link>
            <button ref={closeMenuRef} className="icon-btn drawer-close" onClick={close} aria-label="Close menu">✕</button>
          </div>
          {user ? (
            <Link to="/profile-settings" className="drawer-user" onClick={close}>
              <span className="drawer-user-avatar">{initial}</span>
              <span><b>{user.name || t('acct.guest')}</b><small>{user.phone}</small></span>
              <span className="drawer-user-arrow" aria-hidden="true">›</span>
            </Link>
          ) : <Link to="/login" className="drawer-user" onClick={close}><span className="drawer-user-avatar">↗</span><span><b>{t('hdr.signInUp')}</b><small>Sign in to your Jyotiva account</small></span></Link>}

          <div className="drawer-scroll">
            {sections.map(section => (
              <section className="drawer-section" key={section.title}>
                <h2>{section.title}</h2>
                {section.groups.map((group, i) => (
                  <details className="drawer-group" key={group.label} open={group.label === 'Consult' || group.items.some(item => isActive(item.to))}>
                    <summary>
                      <span className="drawer-icon" aria-hidden="true">{section.title === 'Consult' ? (i === 0 ? '▢' : '☼') : ['☆', '▦', '▤'][i]}</span>
                      <span>{t(group.key)}</span><span className="drawer-chevron" aria-hidden="true">⌄</span>
                    </summary>
                    <div className="drawer-group-links">
                      {group.items.map(item => <Link key={item.to} to={item.to} aria-current={isActive(item.to) ? 'page' : undefined} onClick={close}>{item.label}</Link>)}
                    </div>
                  </details>
                ))}
              </section>
            ))}

            <section className="drawer-section">
              <h2>Discover</h2>
              <Link className="drawer-row" to="/astrology-blog" aria-current={isActive('/astrology-blog') ? 'page' : undefined} onClick={close}><span className="drawer-icon" aria-hidden="true">✎</span>Astrology Blog</Link>
            </section>
            {user && <section className="drawer-section">
              <h2>Account</h2>
              {user.role === 'admin' && <Link className="drawer-row" to={adminLandingPath(user)} onClick={close}><span className="drawer-icon" aria-hidden="true">⚙</span>Admin tools</Link>}
              <AstrologerPanelLink />
              {ACCOUNT.map(item => <Link className="drawer-row" key={item.to} to={item.to} onClick={close}><span className="drawer-icon" aria-hidden="true">›</span>{t(item.key!)}</Link>)}
              <Link className="drawer-row" to="/logout" onClick={close}><span className="drawer-icon" aria-hidden="true">↪</span>{t('acct.logout')}</Link>
            </section>}
          </div>
        </aside>
      </>,
      document.body,
    )}
    </>
  )
}
