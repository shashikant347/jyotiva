import { useState, type FormEvent, type ReactNode } from 'react'
import { usePageMeta } from '../hooks'
import { api, isApiError } from '../services/api'
import { todayISO } from '../utils'

type Kind = 'names' | 'name' | 'date' | 'digits'
interface Def { slug: string; title: string; intro: string; kind: Kind; labels?: [string, string]; button?: string; render: (r: any) => ReactNode }

const Big = ({ children, sub }: { children: ReactNode; sub?: string }) => <><p className="balance">{children}</p>{sub && <p className="muted">{sub}</p>}</>
const Note = ({ r }: { r: { note?: string } }) => (r.note ? <p className="muted small">{r.note}</p> : null)

export const CALCULATORS: Def[] = [
  { slug: 'love-calculator', title: 'Love Calculator', intro: 'A just-for-fun score from two names.', kind: 'names', labels: ['Your name', "Partner's name"], render: r => <><Big>{r.percent}%</Big><Note r={r} /></> },
  { slug: 'flames-calculator', title: 'FLAMES Calculator', intro: 'The classic school game: Friends, Love, Affection, Marriage, Enemies, Siblings.', kind: 'names', labels: ['First name', 'Second name'], render: r => <><Big sub={`${r.remaining} letters left after cancelling`}>{r.result}</Big><Note r={r} /></> },
  { slug: 'friendship-calculator', title: 'Friendship Calculator', intro: 'A just-for-fun friendship score from two names.', kind: 'names', labels: ['Your name', "Friend's name"], render: r => <><Big>{r.percent}%</Big><Note r={r} /></> },
  { slug: 'name-compatibility-calculator', title: 'Name Compatibility Calculator', intro: 'Compare the numerology numbers of two names.', kind: 'names', labels: ['First name', 'Second name'], render: r => <><Big sub={`${r.first.number} and ${r.second.number}`}>{r.level}</Big><Note r={r} /></> },
  { slug: 'name-numerology-calculator', title: 'Name Numerology Calculator', intro: 'Find the number of your name (Pythagorean system, A=1 … I=9, J=1 …).', kind: 'name', render: r => <><Big sub={`Letter total ${r.total}`}>{r.number}</Big></> },
  { slug: 'mulank-calculator', title: 'Mulank (Root Number) Calculator', intro: 'Your Mulank is the day of birth reduced to a single digit.', kind: 'date', render: r => <Big sub={`Born on day ${r.dayOfBirth}`}>{r.mulank}</Big> },
  { slug: 'destiny-number-calculator', title: 'Destiny Number (Bhagyank) Calculator', intro: 'Your Bhagyank is the sum of all digits of your full date of birth, reduced to a single digit.', kind: 'date', render: r => <Big sub={`Digit total ${r.total}`}>{r.destinyNumber}</Big> },
  { slug: 'mobile-number-numerology-calculator', title: 'Mobile Number Numerology', intro: 'Add the digits of a mobile number and reduce them to one digit.', kind: 'digits', labels: ['Mobile number', ''], render: r => <Big sub={`Digit total ${r.total}`}>{r.number}</Big> },
  { slug: 'lucky-vehicle-number-calculator', title: 'Vehicle Number Numerology', intro: 'Enter only the digits of the registration number (for example 4521).', kind: 'digits', labels: ['Vehicle number digits', ''], render: r => <Big sub={`Digit total ${r.total}`}>{r.number}</Big> },
  {
    slug: 'lo-shu-grid-calculator', title: 'Lo Shu Grid Calculator', intro: 'Place the digits of your date of birth on the Lo Shu square.', kind: 'date',
    render: r => (
      <>
        <div className="loshu" role="table" aria-label="Lo Shu grid">
          {r.grid.flat().map((c: { n: number; count: number }) => <div key={c.n} role="cell" className={c.count ? 'has' : ''}><b>{c.count ? String(c.n).repeat(c.count) : '–'}</b><span className="muted small">{c.n}</span></div>)}
        </div>
        <p>Missing numbers: {r.missing.length ? r.missing.join(', ') : 'none'}. Repeated: {r.repeated.length ? r.repeated.join(', ') : 'none'}.</p>
        <p className="muted small">Mulank {r.mulank}, Bhagyank {r.destiny}. Zeros in the date are ignored.</p>
      </>
    ),
  },
  { slug: 'age-calculator', title: 'Age Calculator', intro: 'Your exact age in years, months and days.', kind: 'date', render: r => <Big sub={`${r.totalDays.toLocaleString('en-IN')} days old on ${r.asOf}`}>{r.years} years, {r.months} months, {r.days} days</Big> },
  { slug: 'moon-phase-calculator', title: 'Moon Phase Calculator', intro: 'See the Moon phase and tithi on any date.', kind: 'date', button: 'Show phase', render: r => <><Big sub={`${r.illuminationPercent}% lit · ${r.paksha}, tithi ${r.tithiNumber > 15 ? r.tithiNumber - 15 : r.tithiNumber}`}>{r.phase}</Big><p className="muted">Next full moon: {r.nextFullMoon}. Next new moon: {r.nextNewMoon}.</p><Note r={r} /></> },
]

export default function Calculator({ slug }: { slug: string }) {
  const def = CALCULATORS.find(c => c.slug === slug)!
  usePageMeta(def.title, { description: def.intro })
  const [a, setA] = useState(''), [b, setB] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [res, setRes] = useState<unknown>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setErr(''); setRes(null)
    const body = def.kind === 'names' ? { first: a, second: b } : def.kind === 'name' ? { name: a } : def.kind === 'digits' ? { number: a } : { date: a }
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
        <div className="field">
          <label htmlFor="c1">{def.kind === 'date' ? (slug === 'moon-phase-calculator' ? 'Date' : 'Date of birth') : label(0, 'Name')}</label>
          <input id="c1" value={a} type={def.kind === 'date' ? 'date' : 'text'} inputMode={def.kind === 'digits' ? 'numeric' : undefined} max={def.kind === 'date' && slug !== 'moon-phase-calculator' ? todayISO() : undefined} onChange={e => setA(e.target.value)} />
        </div>
        {def.kind === 'names' && <div className="field"><label htmlFor="c2">{label(1, 'Second name')}</label><input id="c2" value={b} onChange={e => setB(e.target.value)} /></div>}
        {err && <p className="alert" role="alert">{err}</p>}
        <button className="btn btn-gold" disabled={busy}>{busy ? 'Calculating…' : def.button ?? 'Calculate'}</button>
      </form>
      {res !== null && <div className="panel" aria-live="polite"><h2>Result</h2>{def.render(res)}</div>}
      <p className="muted small">Numerology and name games are for guidance and entertainment only.</p>
    </section>
  )
}
