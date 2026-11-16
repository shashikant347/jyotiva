import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, isApiError } from '../services/api'
import { usePageMeta } from '../hooks'

type CompatibilityResult = { first: string; second: string; score: number; elements: string[]; modes: string[]; summary: string; method: string }
type TarotResult = { spread: string; cards: { position: string; name: string; reflection: string }[]; disclaimer: string }
const titleCase = (s: string) => s.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
const SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'] as const

export function Compatibility() {
  const { pair } = useParams()
  const navigate = useNavigate()
  const initial = pair?.split('-') ?? []
  const [a, setA] = useState(SIGNS.includes(initial[0]?.replace(/^./, c => c.toUpperCase()) as typeof SIGNS[number]) ? initial[0][0].toUpperCase() + initial[0].slice(1) : 'Aries')
  const [b, setB] = useState(SIGNS.includes(initial[1]?.replace(/^./, c => c.toUpperCase()) as typeof SIGNS[number]) ? initial[1][0].toUpperCase() + initial[1].slice(1) : 'Libra')
  const [result, setResult] = useState<CompatibilityResult | null>(null)
  const [error, setError] = useState('')
  usePageMeta('Zodiac Compatibility', { description: 'Explore a light, original zodiac element and modality comparison.' })
  useEffect(() => {
    if (!pair) { setResult(null); return }
    api<CompatibilityResult>(`/tools/compatibility/${encodeURIComponent(a)}/${encodeURIComponent(b)}`, { auth: false }).then(setResult).catch(e => setError(isApiError(e) ? e.message : 'Could not load this pairing.'))
  }, [pair, a, b])
  function submit(e: FormEvent) { e.preventDefault(); setError(''); navigate(`/compatibility/${a.toLowerCase()}-${b.toLowerCase()}`) }
  return <section className="wrap sec settings">
    <h1 className="page-h">Zodiac Compatibility</h1>
    <p className="lead">Compare broad zodiac elements and modes. Use this as a conversation prompt, not a measure of a relationship.</p>
    <form className="panel form" onSubmit={submit}>
      <div className="row2"><div className="field"><label htmlFor="sign-a">First sign</label><select id="sign-a" value={a} onChange={e => setA(e.target.value)}>{SIGNS.map(s => <option key={s}>{s}</option>)}</select></div><div className="field"><label htmlFor="sign-b">Second sign</label><select id="sign-b" value={b} onChange={e => setB(e.target.value)}>{SIGNS.map(s => <option key={s}>{s}</option>)}</select></div></div>
      <button className="btn btn-gold">Compare signs</button>
      {error && <p className="alert" role="alert">{error}</p>}
    </form>
    {result && <div className="panel" aria-live="polite"><h2>{result.first} + {result.second}</h2><p className="balance">{result.score}<span className="muted"> / 100</span></p><p>{result.summary}</p><p className="muted small">Elements: {result.elements.join(' + ')} · Modes: {result.modes.join(' + ')}</p><p className="muted small">{result.method}</p></div>}
    <p className="muted small">For birth-chart matching, use <Link to="/matchmaking">Kundli Matching</Link>.</p>
  </section>
}

const SPREADS = ['single', 'three', 'love', 'career', 'finance'] as const
export function Tarot({ initialSpread = 'single' }: { initialSpread?: string }) {
  const normalizedSpread = initialSpread === '3-card' ? 'three' : initialSpread
  const [spread, setSpread] = useState<(typeof SPREADS)[number]>(SPREADS.includes(normalizedSpread as (typeof SPREADS)[number]) ? normalizedSpread as (typeof SPREADS)[number] : 'single')
  const [result, setResult] = useState<TarotResult | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  usePageMeta('Tarot Reflection', { description: 'Draw original, reflective tarot prompts for entertainment.' })
  useEffect(() => {
    if (SPREADS.includes(normalizedSpread as (typeof SPREADS)[number])) setSpread(normalizedSpread as (typeof SPREADS)[number])
    setResult(null)
  }, [normalizedSpread])
  async function loadCards() {
    setBusy(true); setError(''); setResult(null)
    try { setResult(await api<TarotResult>('/tools/tarot/draw', { method: 'POST', body: { spread }, auth: false })) }
    catch (e) { setError(isApiError(e) ? e.message : 'Could not draw cards.'); }
    finally { setBusy(false) }
  }
  async function draw(e: FormEvent) { e.preventDefault(); await loadCards() }
  return <section className="wrap sec settings">
    <h1 className="page-h">Tarot Reflection</h1>
    <p className="lead">Choose a spread and draw cards for original reflection prompts. This is a random entertainment activity, not a prediction.</p>
    <form className="panel form" onSubmit={draw}>
      <div className="field"><label htmlFor="spread">Spread</label><select id="spread" value={spread} onChange={e => setSpread(e.target.value as (typeof SPREADS)[number])}>{SPREADS.map(s => <option key={s} value={s}>{titleCase(s)}</option>)}</select></div>
      <button className="btn btn-gold" disabled={busy}>{busy ? 'Drawing…' : 'Draw cards'}</button>
      {error && <p className="alert" role="alert">{error}</p>}
    </form>
    {result && <div className="panel" aria-live="polite"><h2>Your cards</h2><div className="cats">{result.cards.map((card, i) => <article className="qcard" key={`${card.name}-${i}`}><p className="muted small">{card.position}</p><h3>{card.name}</h3><p>{card.reflection}</p></article>)}</div><p className="muted small">{result.disclaimer}</p><button className="linkish" type="button" onClick={() => void loadCards()} disabled={busy}>Draw again</button></div>}
    <p className="muted small">The deck contains 78 standard card names with Jyotiva-written reflection prompts.</p>
  </section>
}
