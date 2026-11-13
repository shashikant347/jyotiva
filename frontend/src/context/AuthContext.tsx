import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, clearSession, getRefreshToken, hasStoredSession, refreshSession, setAuthLostHandler, setSession } from '../services/api'
import type { Language, ThemeMode, User } from '../types'

type ProfilePatch = Partial<Pick<User, 'name' | 'gender' | 'email' | 'language' | 'theme'>>

interface AuthValue {
  user: User | null
  loading: boolean
  sendOtp: (phone: string) => Promise<{ expiresInSec: number; resendAfterSec: number; devOtp?: string }>
  verifyOtp: (phone: string, code: string, initial?: { language: Language; theme: ThemeMode }) => Promise<{ user: User; isNewUser: boolean }>
  logout: () => Promise<void>
  updateUser: (patch: ProfilePatch) => Promise<User>
}

const Ctx = createContext<AuthValue | null>(null)

interface VerifyResponse { accessToken: string; refreshToken: string; user: User; isNewUser: boolean }

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setAuthLostHandler(() => setUser(null))
    let live = true
    ;(async () => {
      if (hasStoredSession()) {
        try {
          if (await refreshSession()) {
            const me = await api<User>('/me')
            if (live) setUser(me)
          }
        } catch { /* stay signed out; a stored token survives a temporary outage */ }
      }
      if (live) setLoading(false)
    })()
    return () => { live = false; setAuthLostHandler(null) }
  }, [])

  const sendOtp = useCallback((phone: string) =>
    api<{ expiresInSec: number; resendAfterSec: number; devOtp?: string }>('/auth/send-otp', { method: 'POST', body: { phone }, auth: false }), [])

  const verifyOtp = useCallback(async (phone: string, code: string, initial?: { language: Language; theme: ThemeMode }) => {
    const d = await api<VerifyResponse>('/auth/verify-otp', { method: 'POST', body: { phone, code, ...initial }, auth: false })
    setSession(d.accessToken, d.refreshToken)
    setUser(d.user)
    return { user: d.user, isNewUser: d.isNewUser }
  }, [])

  const logout = useCallback(async () => {
    const rt = getRefreshToken()
    try { if (rt) await api('/auth/logout', { method: 'POST', body: { refreshToken: rt }, auth: false }) } catch { /* sign out locally regardless */ }
    clearSession()
    setUser(null)
  }, [])

  const updateUser = useCallback(async (patch: ProfilePatch) => {
    const next = await api<User>('/me', { method: 'PATCH', body: patch })
    setUser(next)
    return next
  }, [])

  const value = useMemo(() => ({ user, loading, sendOtp, verifyOtp, logout, updateUser }), [user, loading, sendOtp, verifyOtp, logout, updateUser])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth must be used inside AuthProvider')
  return v
}
