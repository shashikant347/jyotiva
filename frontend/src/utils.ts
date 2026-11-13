import { isApiError } from './services/api'

export function errorText(e: unknown, t: (k: string) => string): string {
  if (isApiError(e)) return e.code === 'NETWORK' ? t('auth.network') : e.message
  return t('auth.network')
}

/** Field-level messages from a VALIDATION error, keyed by field name. */
export function fieldErrors(e: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  if (isApiError(e) && e.code === 'VALIDATION') for (const d of e.details ?? []) if (d.path && !out[d.path]) out[d.path] = d.message
  return out
}

export const todayISO = (): string => new Date().toISOString().slice(0, 10)
