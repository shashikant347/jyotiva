import { useState, type FormEvent } from 'react'
import { usePrefs } from '../context/PrefsContext'
import { api } from '../services/api'
import type { BirthProfile, Gender } from '../types'
import { errorText, fieldErrors, todayISO } from '../utils'

interface Props {
  initial?: BirthProfile
  defaultName?: string
  onSaved: () => void
  onCancel: () => void
}

export default function BirthForm({ initial, defaultName = '', onSaved, onCancel }: Props) {
  const { t } = usePrefs()
  const [name, setName] = useState(initial?.name ?? defaultName)
  const [gender, setGender] = useState<Gender | ''>(initial?.gender ?? '')
  const [birthDate, setBirthDate] = useState(initial?.birthDate ?? '')
  const [birthTime, setBirthTime] = useState(initial?.birthTime ?? '')
  const [timeUnknown, setTimeUnknown] = useState(initial ? initial.birthTime === null : false)
  const [birthPlace, setBirthPlace] = useState(initial?.birthPlace ?? '')
  const [makePrimary, setMakePrimary] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [fe, setFe] = useState<Record<string, string>>({})

  async function submit(e: FormEvent) {
    e.preventDefault()
    setErr(''); setFe({})
    const payload: Record<string, unknown> = {
      name, gender: gender || undefined, birthDate, birthPlace,
      birthTime: timeUnknown || !birthTime ? null : birthTime,
    }
    if (makePrimary) payload.isPrimary = true // never send false: the API refuses to demote the primary profile
    setBusy(true)
    try {
      if (initial) await api(`/me/birth-profiles/${initial.id}`, { method: 'PATCH', body: payload })
      else await api('/me/birth-profiles', { method: 'POST', body: payload })
      onSaved()
    } catch (x) {
      const f = fieldErrors(x)
      setFe(f)
      if (!Object.keys(f).length) setErr(errorText(x, t))
    } finally { setBusy(false) }
  }

  return (
    <form className="form panel" onSubmit={submit} noValidate>
      <div className="field"><label htmlFor="bp-name">{t('birth.name')}</label>
        <input id="bp-name" value={name} onChange={e => setName(e.target.value)} maxLength={80} required autoComplete="off" aria-invalid={!!fe.name} />
        {fe.name && <p className="err">{fe.name}</p>}</div>
      <div className="field"><label htmlFor="bp-gender">{t('birth.gender')}</label>
        <select id="bp-gender" value={gender} onChange={e => setGender(e.target.value as Gender | '')} required aria-invalid={!!fe.gender}>
          <option value="">{t('gender.select')}</option>
          <option value="male">{t('gender.male')}</option><option value="female">{t('gender.female')}</option><option value="other">{t('gender.other')}</option>
        </select>
        {fe.gender && <p className="err">{fe.gender}</p>}</div>
      <div className="field"><label htmlFor="bp-date">{t('birth.date')}</label>
        <input id="bp-date" type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} min="1900-01-01" max={todayISO()} required aria-invalid={!!fe.birthDate} />
        {fe.birthDate && <p className="err">{fe.birthDate}</p>}</div>
      <div className="field"><label htmlFor="bp-time">{t('birth.time')}</label>
        <input id="bp-time" type="time" value={timeUnknown ? '' : birthTime} onChange={e => setBirthTime(e.target.value)} disabled={timeUnknown} aria-invalid={!!fe.birthTime} />
        <label className="check"><input type="checkbox" checked={timeUnknown} onChange={e => setTimeUnknown(e.target.checked)} /> {t('birth.unknownTime')}</label>
        {fe.birthTime && <p className="err">{fe.birthTime}</p>}</div>
      <div className="field"><label htmlFor="bp-place">{t('birth.place')}</label>
        <input id="bp-place" value={birthPlace} onChange={e => setBirthPlace(e.target.value)} maxLength={120} required autoComplete="off" aria-invalid={!!fe.birthPlace} />
        <p className="muted small">{t('birth.placeHelp')}</p>
        {fe.birthPlace && <p className="err">{fe.birthPlace}</p>}</div>
      {!initial?.isPrimary && <label className="check"><input type="checkbox" checked={makePrimary} onChange={e => setMakePrimary(e.target.checked)} /> {t('birth.makePrimary')}</label>}
      {err && <p className="alert" role="alert">{err}</p>}
      <div className="row">
        <button className="btn btn-gold sm" type="submit" disabled={busy}>{busy ? t('profile.saving') : t('birth.save')}</button>
        <button className="btn btn-line sm" type="button" onClick={onCancel}>{t('common.cancel')}</button>
      </div>
    </form>
  )
}
