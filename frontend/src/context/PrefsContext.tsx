import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import en from '../i18n/en.json'
import hi from '../i18n/hi.json'
import type { Language, ThemeMode } from '../types'

const DICTS: Record<Language, Record<string, string>> = { en, hi }
const THEME_KEY = 'theme'
const LANG_KEY = 'lang'

const read = (k: string): string | null => { try { return localStorage.getItem(k) } catch { return null } }
const write = (k: string, v: string): void => { try { localStorage.setItem(k, v) } catch { /* storage unavailable */ } }

interface PrefsValue {
  theme: ThemeMode
  resolvedTheme: 'light' | 'dark'
  lang: Language
  setTheme: (t: ThemeMode) => void
  setLang: (l: Language) => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

const Ctx = createContext<PrefsValue | null>(null)

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const v = read(THEME_KEY)
    return v === 'light' || v === 'dark' ? v : 'auto'
  })
  const [lang, setLangState] = useState<Language>(() => (read(LANG_KEY) === 'hi' ? 'hi' : 'en'))
  const [systemDark, setSystemDark] = useState<boolean>(() => !!window.matchMedia?.('(prefers-color-scheme: dark)').matches)

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!mq) return
    const on = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  const resolvedTheme: 'light' | 'dark' = theme === 'auto' ? (systemDark ? 'dark' : 'light') : theme

  useEffect(() => { document.documentElement.dataset.theme = resolvedTheme }, [resolvedTheme])
  useEffect(() => { document.documentElement.lang = lang }, [lang])

  const setTheme = useCallback((v: ThemeMode) => { setThemeState(v); write(THEME_KEY, v) }, [])
  const setLang = useCallback((v: Language) => { setLangState(v); write(LANG_KEY, v) }, [])

  const t = useCallback((key: string, vars?: Record<string, string | number>) => {
    let s = DICTS[lang][key] ?? DICTS.en[key] ?? key
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{{${k}}}`).join(String(v))
    return s
  }, [lang])

  const value = useMemo(() => ({ theme, resolvedTheme, lang, setTheme, setLang, t }), [theme, resolvedTheme, lang, setTheme, setLang, t])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function usePrefs(): PrefsValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('usePrefs must be used inside PrefsProvider')
  return v
}
