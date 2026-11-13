import { useEffect, useId, useRef, useState } from 'react'
import { api } from '../services/api'
import type { PlaceHit } from './types'

interface Props { label: string; value: PlaceHit | null; onChange: (p: PlaceHit | null) => void; error?: string }

/** Type-ahead for Indian cities. Selecting a result fixes latitude, longitude and time zone. */
export default function PlaceInput({ label, value, onChange, error }: Props) {
  const id = useId()
  const [text, setText] = useState(value ? `${value.name}, ${value.state}` : '')
  const [hits, setHits] = useState<PlaceHit[]>([])
  const [open, setOpen] = useState(false)
  const seq = useRef(0)

  useEffect(() => {
    if (value || text.trim().length < 2) { setHits([]); return }
    const n = ++seq.current
    const h = setTimeout(() => {
      api<{ places: PlaceHit[] }>(`/tools/places?q=${encodeURIComponent(text.trim())}`, { auth: false })
        .then(r => { if (n === seq.current) { setHits(r.places); setOpen(true) } })
        .catch(() => { if (n === seq.current) setHits([]) })
    }, 200)
    return () => clearTimeout(h)
  }, [text, value])

  return (
    <div className="field place">
      <label htmlFor={id}>{label}</label>
      <input id={id} value={text} autoComplete="off" role="combobox" aria-expanded={open && hits.length > 0} aria-controls={id + '-list'}
        aria-invalid={!!error} placeholder="Start typing a city, e.g. Noida"
        onChange={e => { setText(e.target.value); if (value) onChange(null); setOpen(true) }}
        onBlur={() => setTimeout(() => setOpen(false), 150)} />
      {open && hits.length > 0 && (
        <ul className="suggest" id={id + '-list'} role="listbox">
          {hits.map(p => (
            <li key={p.name + p.state} role="option" aria-selected={false}>
              <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => { onChange(p); setText(`${p.name}, ${p.state}`); setOpen(false) }}>
                {p.name} <span className="muted small">{p.state}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {value && <span className="muted small">{value.latitude.toFixed(2)}°N, {value.longitude.toFixed(2)}°E · {value.timezone}</span>}
      {!value && text.trim().length >= 2 && hits.length === 0 && <span className="muted small">Pick a city from the list. More places are added in a later phase.</span>}
      {error && <p className="err">{error}</p>}
    </div>
  )
}
