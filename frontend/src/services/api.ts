// Tiny API client. Access token lives in memory only; the refresh token is kept in localStorage
// so a reload keeps you signed in. (Trade-off: readable by injected scripts. The stricter option is an
// httpOnly cookie set by the API; revisit before launch together with CSRF handling.)

const BASE = '/api/v1'
const RT_KEY = 'jv_refresh'

export interface ApiError extends Error {
  status: number
  code: string
  details?: { path: string; message: string }[]
}

function makeError(status: number, code: string, message: string, details?: ApiError['details']): ApiError {
  return Object.assign(new Error(message), { status, code, details })
}

let accessToken: string | null = null
let refreshing: Promise<boolean> | null = null
let onAuthLost: (() => void) | null = null

const readRt = (): string | null => { try { return localStorage.getItem(RT_KEY) } catch { return null } }
const writeRt = (v: string | null): void => {
  try { v ? localStorage.setItem(RT_KEY, v) : localStorage.removeItem(RT_KEY) } catch { /* storage unavailable */ }
}

export const setAuthLostHandler = (fn: (() => void) | null): void => { onAuthLost = fn }
export const getAccessToken = (): string | null => accessToken
export const hasStoredSession = (): boolean => !!readRt()
export const getRefreshToken = (): string | null => readRt()
export function setSession(access: string, refresh: string): void { accessToken = access; writeRt(refresh) }
export function clearSession(): void { accessToken = null; writeRt(null) }

async function doRefresh(): Promise<boolean> {
  const used = readRt()
  if (!used) return false
  const attempt = (tok: string) =>
    fetch(`${BASE}/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: tok }) }).catch(() => null)

  let res = await attempt(used)
  if (res && res.status === 401) {
    const now = readRt() // another tab may have rotated it a moment ago
    if (now && now !== used) res = await attempt(now)
  }
  if (!res) return false // offline: keep the session, just fail this call
  if (!res.ok) {
    if (res.status === 401) { clearSession(); onAuthLost?.() }
    return false
  }
  const json = await res.json()
  setSession(json.data.accessToken, json.data.refreshToken)
  return true
}

/** One refresh at a time, shared by every caller. */
export function refreshSession(): Promise<boolean> {
  if (!refreshing) refreshing = doRefresh().finally(() => { refreshing = null })
  return refreshing
}

export async function api<T>(path: string, opts: { method?: string; body?: unknown; auth?: boolean } = {}): Promise<T> {
  const { method = 'GET', body, auth = true } = opts
  const send = () =>
    fetch(BASE + path, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(auth && accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })

  let res: Response
  try {
    res = await send()
    if (res.status === 401 && auth && readRt() && (await refreshSession())) res = await send()
  } catch {
    throw makeError(0, 'NETWORK', 'Network error')
  }

  let json: { success?: boolean; data?: T; error?: { code?: string; message?: string; details?: ApiError['details'] } } | null = null
  try { json = await res.json() } catch { /* non-JSON response */ }
  if (!res.ok || !json?.success) {
    const e = json?.error
    throw makeError(res.status, e?.code ?? 'UNKNOWN', e?.message ?? 'Something went wrong', e?.details)
  }
  return json.data as T
}

/** Upload a raw image body while preserving the normal access-token refresh behavior. */
export async function uploadImage<T>(path: string, file: File): Promise<T> {
  const send = () => fetch(BASE + path, {
    method: 'PUT',
    headers: { 'Content-Type': file.type, ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
    body: file,
  })
  let res: Response
  try {
    res = await send()
    if (res.status === 401 && readRt() && (await refreshSession())) res = await send()
  } catch { throw makeError(0, 'NETWORK', 'Network error') }
  let json: { success?: boolean; data?: T; error?: { code?: string; message?: string } } | null = null
  try { json = await res.json() } catch { /* non-JSON response */ }
  if (!res.ok || !json?.success) throw makeError(res.status, json?.error?.code ?? 'UNKNOWN', json?.error?.message ?? 'Something went wrong')
  return json.data as T
}

export async function downloadFile(path: string, filename: string): Promise<void> {
  const send = () => fetch(BASE + path, { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {} })
  let res: Response
  try {
    res = await send()
    if (res.status === 401 && readRt() && (await refreshSession())) res = await send()
  } catch {
    throw makeError(0, 'NETWORK', 'Network error')
  }
  if (!res.ok) {
    let json: { error?: { code?: string; message?: string; details?: ApiError['details'] } } | null = null
    try { json = await res.json() } catch { /* non-JSON response */ }
    throw makeError(res.status, json?.error?.code ?? 'UNKNOWN', json?.error?.message ?? 'Could not download the file', json?.error?.details)
  }
  const url = URL.createObjectURL(await res.blob())
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const isApiError = (e: unknown): e is ApiError => e instanceof Error && 'code' in e && 'status' in e
