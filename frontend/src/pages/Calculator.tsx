import { useState, type FormEvent, type ReactNode } from 'react'
import { isPlannedRoute } from '../data'
import { usePageMeta } from '../hooks'
import { api, isApiError } from '../services/api'
import NotFound from './NotFound'
import Placeholder from './Placeholder'
import BirthFields, { emptyBirth, toPayload, validateBirth, type BirthState } from '../astro/BirthFields'

type Kind = 'names' | 'name' | 'birth'
interface Def { slug: string; title: string; intro: string; kind: Kind; labels?: [string, string]; button?: string; render: (r: any) => ReactNode }

const Big = ({ children, sub }: { children: ReactNode; sub?: string }) => <><p className="balance">{children}</p>{sub && <p className="muted">{sub}</p>}</>
const Note = ({ r }: { r: { note?: string } }) => (r.note ? <p className="muted small">{r.note}</p> : null)

export const CALCULATORS: Def[] = [
  { slug: 'love-calculator', title: 'Love Calculator', intro: 'A just-for-fun score from two names.', kind: 'names', labels: ['Your name', "Partner's name"], render: r => <><Big>{r.percent}%</Big><Note r={r} /></> },
  { slug: 'name-numerology-calculator', title: 'Name Numerology Calculator', intro: 'Find the number of your name (Pythagorean system, A=1 … I=9, J=1 …).', kind: 'name', render: r => <><Big sub={`Letter total ${r.total}`}>{r.number}</Big></> },
  { slug: 'sun-sign-calculator', title: 'Sun Sign Calculator', intro: 'Find your sidereal Sun sign from birth details.', kind: 'birth', render: r => <Structured value={r} /> },
  { slug: 'rising-ascendant-sign-calculator', title: 'Rising / Ascendant Sign Calculator', intro: 'Calculate your sidereal ascendant. Accurate birth time and place are important.', kind: 'birth', render: r => <Structured value={r} /> },
  { slug: 'rashi-moon-sign-calculator', title: 'Rashi (Moon Sign) Calculator', intro: 'Find your sidereal Moon sign from birth details.', kind: 'birth', render: r => <Structured value={r} /> },
  { slug: 'nakshatra-birth-star-calculator', title: 'Nakshatra (Birth Star) Calculator', intro: 'Find the Moon nakshatra and pada from birth details.', kind: 'birth', render: r => <Structured value={r} /> },
  { slug: 'dasha-calculator', title: 'Vimshottari Dasha Calculator', intro: 'View your Vimshottari mahadasha and antardasha periods.', kind: 'birth', render: r => <Structured value={r} /> },
  { slug: 'atmakaraka-and-darakaraka-calculator', title: 'Atmakaraka and Darakaraka Calculator', intro: 'Identify the highest and lowest degree among the seven classical planets (Jaimini method).', kind: 'birth', render: r => <Structured value={r} /> },
  { slug: 'mangal-dosha-calculator', title: 'Mangal Dosha Calculator', intro: 'Check the project’s documented Mars house rule from Lagna and Moon.', kind: 'birth', render: r => <Structured value={r} /> },
  { slug: 'shani-sade-sati-calculator', title: 'Shani Sade Sati Calculator', intro: 'Check Saturn’s current sign relative to your natal Moon sign.', kind: 'birth', render: r => <Structured value={r} /> },
]

function Structured({ value }: { value: unknown }) {
  if (!value || typeof value !== 'object') return <p>{String(value)}</p>
  const entries = Object.entries(value as Record<string, unknown>)
  return <dl className="summary">{entries.map(([key, item]) => <div key={key}><dt className="muted small">{key.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase())}</dt><dd style={{ margin: 0 }}>{Array.isArray(item) ? item.length && typeof item[0] === 'object' ? <pre className="muted small" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify(item, null, 2)}</pre> : item.join(', ') || 'None' : item && typeof item === 'object' ? <pre className="muted small" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify(item, null, 2)}</pre> : typeof item === 'boolean' ? item ? 'Yes' : 'No' : String(item ?? '—')}</dd></div>)}</dl>
}

export default function Calculator({ slug }: { slug: string }) {
  const def = CALCULATORS.find(c => c.slug === slug)
  if (!def) return isPlannedRoute(`/${slug}`) ? <Placeholder /> : <NotFound />
  return <CalculatorForm slug={slug} def={def} />
}

function CalculatorForm({ slug, def }: { slug: string; def: Def }) {
  usePageMeta(def.title, { description: def.intro })
  const [a, setA] = useState(''), [b, setB] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [res, setRes] = useState<unknown>(null)
  const [birth, setBirth] = useState<BirthState>(emptyBirth())
  const [birthErrs, setBirthErrs] = useState<Record<string, string>>({})

  async function submit(e: FormEvent) {
    e.preventDefault()
    setErr(''); setRes(null)
    const isBirth = def.kind === 'birth'
    const v = isBirth ? validateBirth(birth) : {}
    setBirthErrs(v)
    if (Object.keys(v).length) return
    const body = def.kind === 'names' ? { first: a, second: b } : def.kind === 'name' ? { name: a } : toPayload(birth)
    setBusy(true)
    try { setRes(await api(`/tools/calc/${slug}`, { method: 'POST', body, auth: false })) }
    catch (x) { setErr(isApiError(x) ? (x.code === 'NETWORK' ? "Can't reach the server. Check your connection." : x.message) : 'Something went wrong') }
    finally { setBusy(false) }
  }

  const label = (i: number, d: string) => def.labels?.[i] || d
  return (
    <section className="wrap sec settings">
      <h1 className="page-h">{def.title}</h1>
      <p className="lead">{def.intro}</p>
      <form className="panel form" onSubmit={submit} noValidate>
        {def.kind === 'birth' ? <BirthFields value={birth} onChange={setBirth} errors={birthErrs} /> : <div className="field">
          <label htmlFor="c1">{label(0, 'Name')}</label>
          <input id="c1" value={a} type="text" onChange={e => setA(e.target.value)} />
        </div>}
        {def.kind === 'names' && <div className="field"><label htmlFor="c2">{label(1, 'Second name')}</label><input id="c2" value={b} onChange={e => setB(e.target.value)} /></div>}
        {err && <p className="alert" role="alert">{err}</p>}
        <button className="btn btn-gold" disabled={busy}>{busy ? 'Calculating…' : def.button ?? 'Calculate'}</button>
      </form>
      {res !== null && <div className="panel" aria-live="polite"><h2>Result</h2>{def.render(res)}</div>}
      <p className="muted small">Numerology and name games are for guidance and entertainment only.</p>
    </section>
  )
}
