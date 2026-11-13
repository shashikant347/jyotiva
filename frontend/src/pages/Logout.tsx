import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePrefs } from '../context/PrefsContext'

export default function Logout() {
  const { user, loading, logout } = useAuth()
  const { t } = usePrefs()
  // Wait for the initial session check, otherwise a hard load of /logout could race it and stay signed in.
  useEffect(() => { if (!loading) void logout() }, [loading, logout])
  if (!loading && !user) return <Navigate to="/" replace />
  return <section className="wrap sec"><p className="muted">{t('common.loading')}</p></section>
}
