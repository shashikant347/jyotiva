import { useEffect } from 'react'
import { useAuth } from './AuthContext'
import { usePrefs } from './PrefsContext'

/** When someone signs in, their saved theme and language win over this browser's local choice. */
export default function PrefsSync() {
  const { user } = useAuth()
  const { setTheme, setLang } = usePrefs()
  const uid = user?.id
  useEffect(() => {
    if (user) { setTheme(user.theme); setLang(user.language) }
    // Only on sign-in/out. Later edits are pushed by the controls that change them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid])
  return null
}
