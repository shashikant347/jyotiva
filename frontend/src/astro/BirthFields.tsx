import { useId } from 'react'
import { todayISO } from '../utils'
import PlaceInput from './PlaceInput'
import type { PlaceHit } from './types'

export interface BirthState { name: string; date: string; time: string; timeUnknown: boolean; place: PlaceHit | null }
export const emptyBirth = (): BirthState => ({ name: '', date: '', time: '', timeUnknown: false, place: null })

export function validateBirth(b: BirthState): Record<string, string> {
  const e: Record<string, string> = {}
  if (!b.date) e.date = 'Enter the date of birth'
  if (!b.timeUnknown && !b.time) e.time = 'Enter the birth time, or tick "I don\'t know"'
  if (!b.place) e.place = 'Choose the birth place from the list'
  return e
}

export const toPayload = (b: BirthState) => ({
  name: b.name.trim() || undefined,
  birthDate: b.date,
  birthTime: b.timeUnknown ? null : b.time,
  latitude: b.place!.latitude,
  longitude: b.place!.longitude,
  timezone: b.place!.timezone,
})

interface Props { title?: string; value: BirthState; onChange: (b: BirthState) => void; errors: Record<string, string> }

export default function BirthFields({ title, value, onChange, errors }: Props) {
  const id = useId()
  const set = (p: Partial<BirthState>) => onChange({ ...value, ...p })
  return (
    <fieldset className="birth">
      {title && <legend>{title}</legend>}
      <div className="field"><label htmlFor={id + 'n'}>Name (optional)</label><input id={id + 'n'} value={value.name} maxLength={80} onChange={e => set({ name: e.target.value })} /></div>
      <div className="row2">
        <div className="field"><label htmlFor={id + 'd'}>Date of birth</label><input id={id + 'd'} type="date" min="1900-01-01" max={todayISO()} value={value.date} aria-invalid={!!errors.date} onChange={e => set({ date: e.target.value })} />{errors.date && <p className="err">{errors.date}</p>}</div>
        <div className="field"><label htmlFor={id + 't'}>Time of birth</label><input id={id + 't'} type="time" value={value.time} disabled={value.timeUnknown} aria-invalid={!!errors.time} onChange={e => set({ time: e.target.value })} />{errors.time && <p className="err">{errors.time}</p>}</div>
      </div>
      <label className="check"><input type="checkbox" checked={value.timeUnknown} onChange={e => set({ timeUnknown: e.target.checked, time: e.target.checked ? '' : value.time })} /> I don't know the birth time</label>
      <PlaceInput label="Birth place" value={value.place} onChange={p => set({ place: p })} error={errors.place} />
    </fieldset>
  )
}
