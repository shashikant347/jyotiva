import { useEffect } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePrefs } from '../context/PrefsContext'

export default function ProtectedRoute() {
  const { user, loading } = useAuth()
  const { t } = usePrefs()
  const loc = useLocation()

  // Logged-in pages must not be indexed (plan section 14).
  useEffect(() => {
    const m = document.createElement('meta')
    m.name = 'robots'
    m.content = 'noindex'
    document.head.appendChild(m)
    return () => { m.remove() }
  }, [])

  if (loading) return <section className="wrap sec"><p className="muted">{t('common.loading')}</p></section>
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />
  return <Outlet />
}
