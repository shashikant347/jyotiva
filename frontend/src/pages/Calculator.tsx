import { useState, type FormEvent, type ReactNode } from 'react'
import { isPlannedRoute } from '../data'
import { usePageMeta } from '../hooks'
import { api, isApiError } from '../services/api'
import { todayISO } from '../utils'
import NotFound from './NotFound'
import Placeholder from './Placeholder'
import BirthFields, { emptyBirth, toPayload, validateBirth, type BirthState } from '../astro/BirthFields'

type Kind = 'names' | 'name' | 'date' | 'digits' | 'birth' | 'transit'
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
  { slug: 'lucky-name-numerology-calculator', title: 'Lucky Name Numerology', intro: 'Calculate your name number using the Pythagorean letter system. This does not suggest or validate a name change.', kind: 'name', render: r => <><Big sub={`Letter total ${r.total}`}>{r.number}</Big><p className="muted small">A name number is a numerology convention, not a prediction.</p></> },
  { slug: 'sun-sign-calculator', title: 'Sun Sign Calculator', intro: 'Find your sidereal Sun sign from birth details.', kind: 'birth', render: r => <Structured value={r} /> },
  { slug: 'rising-ascendant-sign-calculator', title: 'Rising / Ascendant Sign Calculator', intro: 'Calculate your sidereal ascendant. Accurate birth time and place are important.', kind: 'birth', render: r => <Structured value={r} /> },
  { slug: 'rashi-moon-sign-calculator', title: 'Rashi (Moon Sign) Calculator', intro: 'Find your sidereal Moon sign from birth details.', kind: 'birth', render: r => <Structured value={r} /> },
  { slug: 'nakshatra-birth-star-calculator', title: 'Nakshatra (Birth Star) Calculator', intro: 'Find the Moon nakshatra and pada from birth details.', kind: 'birth', render: r => <Structured value={r} /> },
  { slug: 'dasha-calculator', title: 'Vimshottari Dasha Calculator', intro: 'View your Vimshottari mahadasha and antardasha periods.', kind: 'birth', render: r => <Structured value={r} /> },
  { slug: 'birth-natal-chart-calculator', title: 'Birth / Natal Chart Calculator', intro: 'Calculate a sidereal natal chart with whole-sign houses.', kind: 'birth', render: r => <Structured value={r} /> },
  { slug: 'transit-chart-calculator', title: 'Transit Chart Calculator', intro: 'See sidereal planetary transits by sign and whole-sign house from your natal ascendant.', kind: 'transit', render: r => <Structured value={r} /> },
  { slug: 'atmakaraka-and-darakaraka-calculator', title: 'Atmakaraka and Darakaraka Calculator', intro: 'Identify the highest and lowest degree among the seven classical planets (Jaimini method).', kind: 'birth', render: r => <Structured value={r} /> },
  { slug: 'ishta-devata-calculator', title: 'Ishta Devata Chart Factors', intro: 'Calculate Karakamsha and the 12th sign factor. Deity mappings differ by tradition and are not inferred.', kind: 'birth', render: r => <Structured value={r} /> },
  { slug: 'mangal-dosha-calculator', title: 'Mangal Dosha Calculator', intro: 'Check the project’s documented Mars house rule from Lagna and Moon.', kind: 'birth', render: r => <Structured value={r} /> },
  { slug: 'shani-sade-sati-calculator', title: 'Shani Sade Sati Calculator', intro: 'Check Saturn’s current sign relative to your natal Moon sign.', kind: 'birth', render: r => <Structured value={r} /> },
  { slug: 'kaal-sarp-dosh-calculator', title: 'Kaal Sarp Dosh Calculator', intro: 'Check whether the seven classical planets fall on one side of the mean Rahu–Ketu axis.', kind: 'birth', render: r => <Structured value={r} /> },
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
  const [transitDate, setTransitDate] = useState(todayISO())

  async function submit(e: FormEvent) {
    e.preventDefault()
    setErr(''); setRes(null)
    const isBirth = def.kind === 'birth' || def.kind === 'transit'
    const v = isBirth ? validateBirth(birth) : {}
    setBirthErrs(v)
    if (Object.keys(v).length) return
    const body = def.kind === 'names' ? { first: a, second: b } : def.kind === 'name' ? { name: a } : def.kind === 'digits' ? { number: a } : def.kind === 'birth' ? toPayload(birth) : def.kind === 'transit' ? { birth: toPayload(birth), transitDate } : { date: a }
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
        {(def.kind === 'birth' || def.kind === 'transit') ? <><BirthFields value={birth} onChange={setBirth} errors={birthErrs} />{def.kind === 'transit' && <div className="field"><label htmlFor="transit-date">Transit date</label><input id="transit-date" type="date" min="1900-01-01" max="2100-12-31" value={transitDate} onChange={e => setTransitDate(e.target.value)} /></div>}</> : <div className="field">
          <label htmlFor="c1">{def.kind === 'date' ? (slug === 'moon-phase-calculator' ? 'Date' : 'Date of birth') : label(0, 'Name')}</label>
          <input id="c1" value={a} type={def.kind === 'date' ? 'date' : 'text'} inputMode={def.kind === 'digits' ? 'numeric' : undefined} max={def.kind === 'date' && slug !== 'moon-phase-calculator' ? todayISO() : undefined} onChange={e => setA(e.target.value)} />
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
