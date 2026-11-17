import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import AstrologerCard from '../astrologers/AstrologerCard'
import type { Astro, Meta } from '../astrologers/types'
import { CATEGORIES, FAQ, SIGNS } from '../data'
import { api } from '../services/api'
import { usePrefs } from '../context/PrefsContext'
import './home.css'

/* ---------- small helpers ---------- */
const istDate = (shift = 0): string => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(Date.now() + shift * 86400_000))
const NAKSHATRAS = ['Ashwini','Bharani','Krittika','Rohini','Mrigashira','Ardra','Punarvasu','Pushya','Ashlesha','Magha','Purva Phalguni','Uttara Phalguni','Hasta','Chitra','Swati','Vishakha','Anuradha','Jyeshtha','Mula','Purva Ashadha','Uttara Ashadha','Shravana','Dhanishta','Shatabhisha','Purva Bhadrapada','Uttara Bhadrapada','Revati']
const CAT_ICONS = ['💖','💍','💼','💰','🩺','🔮','📿','🌿','🔢','✋','🎴','🏠','🧿']

// deterministic star field (same on every render)
const STARS = (() => { let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647
  return Array.from({ length: 70 }, () => ({ x: r() * 100, y: r() * 100, z: 1 + r() * 2.2, d: r() * 4 })) })()

interface T { local: string }
interface Pan {
  tithi: { name: string }; nakshatra: { name: string }; yoga: { name: string }; karana: { name: string }
  sunrise: T; sunset: T; moonSign: string; weekday: string
  rahuKaal: { start: T; end: T }; abhijit: { start: T; end: T }
}
const hm = (t: T) => t.local.replace(' (next day)', ' +1').replace(' (previous day)', ' −1')
const rng = (s: { start: T; end: T }) => `${hm(s.start)} – ${hm(s.end)}`

interface HItem { signName: string; text: string; luckyNumber: number | null; luckyColor: string | null; mood: string | null; scores: { love: number | null; career: number | null; health: number | null; money: number | null } }

const CALCS: [string, string, string][] = [
  ['love-calculator', '💞', 'Love'], ['atmakaraka-and-darakaraka-calculator', '🪐', 'Atmakaraka & Darakaraka'],
  ['name-numerology-calculator', '🔢', 'Name numerology'], ['sun-sign-calculator', '☀️', 'Sun sign'],
  ['rising-ascendant-sign-calculator', '🌅', 'Rising sign'], ['rashi-moon-sign-calculator', '🌙', 'Rashi'],
  ['dasha-calculator', '⏳', 'Dasha'], ['nakshatra-birth-star-calculator', '✨', 'Nakshatra'],
  ['mangal-dosha-calculator', '🔴', 'Mangal Dosha'], ['shani-sade-sati-calculator', '🪐', 'Shani Sade Sati'],
]
const GLOSSARY: [string, string, string][] = [
  ['Lagna', 'Ascendant', 'The zodiac sign rising on the eastern horizon when you were born. It sets the layout of all twelve houses and changes roughly every two hours, which is why birth time matters.'],
  ['Nakshatra', 'Lunar mansion', 'The sky along the Moon’s path is split into 27 equal parts. The one the Moon was in at your birth is your birth star and shapes your dasha timeline.'],
  ['Dasha', 'Planetary period', 'Vimshottari dasha is a 120-year cycle of planet periods, starting from your Moon’s nakshatra. It is the main tool for reading when themes in your chart become active.'],
  ['Tithi', 'Lunar day', 'Each time the Moon gains 12° on the Sun, a new tithi begins. There are 30 in a lunar month, and festivals and vrats are fixed by them.'],
  ['Rahu Kaal', 'Daily window', 'About one-eighth of the daylight, at a different slot each weekday. Many traditions avoid starting something new in it. We calculate it from the real sunrise and sunset for your city.'],
  ['Manglik', 'Mars dosha', 'A check of where Mars sits in the chart, relevant in marriage matching. It has many cancellation rules, so it is a reason to look closer, not a verdict.'],
]
const PROMISES: [string, string, string][] = [
  ['🧮', 'Open about the maths', 'Sidereal Lahiri zodiac, whole-sign houses, mean node. Where a table is disputed we leave it out instead of guessing, and we say so.'],
  ['⭐', 'No made-up reviews', 'Ratings and reviews appear only after a real finished session. Until then a profile says “no reviews yet”.'],
  ['🔐', 'Your data, your call', 'Export everything you have given us, or delete your account, from your profile settings.'],
  ['⏱️', 'Pay for minutes, not more', 'Prepaid wallet, billing calculated on our server to the minute, and a balance you can always see.'],
]
const MORE_FAQ: [string, string][] = [
  ['Which zodiac and house system do you use?', 'Charts use the sidereal zodiac with the Lahiri ayanamsa and whole-sign houses, the most common setup in Vedic astrology. Some astrologers prefer other systems, and you can discuss that with them.'],
  ['Why is my Kundli match out of 30 and not 36?', 'Two of the eight kootas, Vashya and Yoni, have published tables that disagree with each other. Until an expert signs one off we do not score them, and we show the total honestly out of 30.'],
  ['How does the wallet work?', 'Add money by UPI, card or netbanking, then pay per minute for chats. Unused balance stays in your wallet. Coupons give a bonus after a successful payment.'],
]

/* ---------- hero art ---------- */
function Wheel() {
  const planets = [{ r: 62, d: 22, c: '#ffd75e', s: 4.2 }, { r: 44, d: 14, c: '#ff8f6b', s: 3.4 }, { r: 28, d: 9, c: '#9ee6ff', s: 3 }]
  return (
    <svg viewBox="-120 -120 240 240" className="hx-wheel" role="img" aria-label="Animated zodiac wheel with twelve sign symbols">
      <defs>
        <radialGradient id="hxSun"><stop offset="0" stopColor="#fff9df" /><stop offset=".45" stopColor="#ffd75e" /><stop offset="1" stopColor="#f6a623" stopOpacity="0" /></radialGradient>
        <linearGradient id="hxRing" x1="0" x2="1"><stop offset="0" stopColor="#fff0a5" /><stop offset=".55" stopColor="#f6c026" /><stop offset="1" stopColor="#df792c" /></linearGradient>
      </defs>
      <g className="hx-spin">
        <circle r="113" fill="none" stroke="url(#hxRing)" strokeWidth="1.5" strokeDasharray="1.5 4" />
        {Array.from({ length: 72 }, (_, i) => { const a = i * 5 * Math.PI / 180, l = i % 6 === 0 ? 7 : 3.5
          return <line key={i} x1={104 * Math.cos(a)} y1={104 * Math.sin(a)} x2={(104 + l) * Math.cos(a)} y2={(104 + l) * Math.sin(a)} stroke="#f6cf70" strokeOpacity=".8" strokeWidth=".7" /> })}
      </g>
      <circle r="100" fill="none" stroke="url(#hxRing)" strokeWidth="1.8" />
      <circle r="72" fill="none" stroke="#f6cf70" strokeOpacity=".65" strokeWidth="1" />
      {SIGNS.map((s, i) => { const a = (i * 30 - 75) * Math.PI / 180, b = a - .2618
        return <g key={s[0]}><line x1={72 * Math.cos(b)} y1={72 * Math.sin(b)} x2={100 * Math.cos(b)} y2={100 * Math.sin(b)} stroke="#f6cf70" strokeOpacity=".58" strokeWidth=".8" />
          <text x={86 * Math.cos(a)} y={86 * Math.sin(a)} textAnchor="middle" dominantBaseline="central" fontFamily="'Segoe UI Symbol', 'Noto Sans Symbols 2', sans-serif" fontSize="13" fontWeight="700" fill="#fff0a5">{s[3] + '\uFE0E'}</text></g> })}
      <g className="hx-spin rev">{[0, 1, 2, 3, 4, 5].map(i => <line key={i} x1="-70" y1="0" x2="70" y2="0" stroke="#f6c026" strokeOpacity=".24" strokeWidth=".6" transform={`rotate(${i * 30})`} />)}</g>
      {planets.map(p => <g key={p.r}><circle r={p.r} fill="none" stroke="#fff" strokeOpacity=".16" strokeDasharray="1 3" />
        <g className="hx-orb" style={{ animationDuration: p.d + 's' }}><circle cx={p.r} r={p.s} fill={p.c} /><circle cx={p.r} r={p.s * 2.4} fill={p.c} opacity=".18" /></g></g>)}
      <circle r="20" fill="url(#hxSun)" /><circle r="7" fill="#fff7d6" />
    </svg>
  )
}

function MiniChart() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.2">
      <rect x="2" y="2" width="96" height="96" rx="3" /><path d="M2 2 98 98M98 2 2 98" /><path d="M50 2 98 50 50 98 2 50Z" />
      <g fill="currentColor" stroke="none" fontSize="7" fontWeight="700"><text x="46" y="30">Su</text><text x="14" y="30">Me</text><text x="72" y="52">Mo</text><text x="46" y="78">Ju</text><text x="22" y="52">Sa</text></g>
    </svg>
  )
}

/* ---------- page ---------- */
export default function Home() {
  const { lang } = usePrefs()
  const root = useRef<HTMLDivElement>(null)
  const [pan, setPan] = useState<Pan | null>(null)
  const [panState, setPanState] = useState<'load' | 'ok' | 'err'>('load')
  const [astros, setAstros] = useState<Astro[] | null>(null)
  const [meta, setMeta] = useState<Meta | null>(null)
  const [sign, setSign] = useState(0)
  const [period, setPeriod] = useState<'Today' | 'Tomorrow' | 'Week' | 'Month'>('Today')
  const [horo, setHoro] = useState<Record<string, HItem> | null>(null)
  const [horoBusy, setHoroBusy] = useState(true)
  const faq = useMemo(() => [...FAQ, ...MORE_FAQ], [])

  // reveal-on-scroll
  useEffect(() => {
    const el = root.current; if (!el) return
    const nodes = Array.from(el.querySelectorAll('.hx-rv'))
    if (!('IntersectionObserver' in window)) return
    el.classList.add('hx-ready')
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) } }), { threshold: .12 })
    nodes.forEach(n => io.observe(n))
    return () => io.disconnect()
  }, [])

  // real panchang for Delhi (same API as the Panchang page)
  useEffect(() => {
    let live = true
    api<Pan>('/tools/panchang', { method: 'POST', body: { date: istDate(), latitude: 28.6139, longitude: 77.209, timezone: 'Asia/Kolkata' }, auth: false })
      .then(r => { if (live) { setPan(r); setPanState('ok') } }).catch(() => { if (live) setPanState('err') })
    return () => { live = false }
  }, [])

  // astrologers (demo profiles until real ones are approved)
  useEffect(() => {
    let live = true
    api<{ items: Astro[] }>('/astrologers?mode=chat&limit=4&sort=popular', { auth: false }).then(r => { if (live) setAstros(r.items) }).catch(() => { if (live) setAstros([]) })
    api<Meta>('/astrologers/categories', { auth: false }).then(m => { if (live) setMeta(m) }).catch(() => {})
    return () => { live = false }
  }, [])

  // horoscope from published entries only
  useEffect(() => {
    let live = true
    setHoroBusy(true)
    const [p, shift] = period === 'Today' ? ['daily', 0] : period === 'Tomorrow' ? ['daily', 1] : period === 'Week' ? ['weekly', 0] : ['monthly', 0]
    api<{ items: (HItem)[] }>(`/horoscope/${p}?date=${istDate(shift as number)}&lang=${lang}`, { auth: false })
      .then(r => { if (live) setHoro(Object.fromEntries(r.items.map(i => [i.signName, i]))) })
      .catch(() => { if (live) setHoro({}) }).finally(() => { if (live) setHoroBusy(false) })
    return () => { live = false }
  }, [period, lang])

  const s = SIGNS[sign]
  const h = horo?.[s[0]]
  const catSlug = (name: string) => meta?.categories.find(c => c.name.toLowerCase() === name.toLowerCase())?.slug
  const bars: [string, number | null | undefined][] = [['Love', h?.scores.love], ['Career', h?.scores.career], ['Health', h?.scores.health], ['Money', h?.scores.money]]

  return (
    <div className="hx" ref={root}>
      {/* HERO */}
      <section className="hx-hero">
        <div className="hx-stars" aria-hidden>{STARS.map((st, i) => <i key={i} className="hx-star" style={{ left: st.x + '%', top: st.y + '%', width: st.z, height: st.z, animationDelay: st.d + 's' }} />)}</div>
        <div className="wrap hx-hero-in">
          <div>
            <span className="hx-pill"><b>NEW</b> Free Kundli, matching and today’s panchang</span>
            <h1>The sky had a plan. <em>Let’s read it together.</em></h1>
            <p className="hx-sub">Get your birth chart in a minute, check today’s muhurat, and talk to astrologers in Hindi or English. Honest maths, clear language, no fear-selling.</p>
            <div className="row">
              <Link className="btn btn-gold hx-cta" to="/freekundli">Make my free Kundli</Link>
              <Link className="btn btn-line" to="/free-astrology-chat">Try a free chat</Link>
            </div>
            <div className="hx-signs" aria-label="Jump to your sign"><span>Your sign today</span>
              {SIGNS.map(x => <Link key={x[0]} to={`/horoscope/daily-horoscope/${x[0].toLowerCase()}`} title={x[0]} aria-label={x[0]}>{x[3]}</Link>)}</div>
          </div>
          <div className="hx-art">
            <Wheel />
            {pan && <>
              <div className="hx-glass hx-g1"><small>Moon today in</small><b>☽ {pan.moonSign}</b></div>
              <div className="hx-glass hx-g2"><small>Rahu Kaal · Delhi</small><b>{rng(pan.rahuKaal)}</b></div>
              <div className="hx-glass hx-g3"><small>Tithi</small><b>{pan.tithi.name}</b></div></>}
          </div>
        </div>
      </section>

      <div className="wrap hx-strip hx-rv"><div className="hx-strip-in">
        {[['₹0', 'Kundli, matching, panchang'], ['10', 'Live calculators'], ['27', 'Nakshatras mapped'], ['EN · हिं', 'Two languages']].map(([n, l]) => <div key={l}><b>{n}</b><span>{l}</span></div>)}
      </div></div>

      <div className="hx-marq" aria-hidden><div className="hx-track">{[...NAKSHATRAS, ...NAKSHATRAS].map((n, i) => <span key={i}>{n}</span>)}</div></div>

      {/* TODAY IN THE SKY */}
      <section className="wrap hx-sec hx-rv">
        <div className="hx-head"><div><span className="hx-eyebrow">✦ Live from the sky</span><h2>Today’s <em>panchang</em></h2></div><Link className="hx-more" to="/panchang/today-panchang">Full panchang with Choghadiya →</Link></div>
        <div className="hx-today">
          <div className="hx-panel">
            <b>{pan ? pan.weekday : 'Today'} · Delhi</b>
            {panState === 'load' && <div className="hx-pgrid">{[1, 2, 3, 4].map(i => <div key={i} className="hx-skel" />)}</div>}
            {panState === 'err' && <p className="muted">Today’s panchang could not load right now. <Link to="/panchang/today-panchang" className="linkish">Open the full page</Link>.</p>}
            {pan && <div className="hx-pgrid">
              {([['Tithi', pan.tithi.name], ['Nakshatra', pan.nakshatra.name], ['Yoga', pan.yoga.name], ['Karana', pan.karana.name], ['Sunrise', hm(pan.sunrise)], ['Sunset', hm(pan.sunset)]] as const).map(([k, v]) => <div key={k}><small>{k}</small><b>{v}</b></div>)}
            </div>}
          </div>
          <div className="hx-panel hx-moon">
            <span className="hx-eyebrow" style={{ color: '#ffd75e' }}>Good window</span>
            <h3>Abhijit Muhurat</h3>
            <p>{pan ? <>Today <b>{rng(pan.abhijit)}</b>. A midday slot traditionally considered favourable for new beginnings.</> : 'The most favourable slot of the day, calculated from real sunrise and sunset.'}</p>
            <Link className="btn btn-gold sm" to="/panchang/today-panchang" style={{ alignSelf: 'flex-start', marginTop: 8 }}>See all timings</Link>
          </div>
        </div>
      </section>

      {/* SERVICES BENTO */}
      <section className="wrap hx-sec hx-rv">
        <div className="hx-head"><div><span className="hx-eyebrow">✦ Everything in one place</span><h2>Start with what you’re <em>curious</em> about</h2></div></div>
        <div className="hx-bento">
          <Link to="/freekundli" className="hx-tile hx-t-k"><span className="free">FREE</span><h3>Your birth chart</h3><p>Planets, houses, dasha and doshas from your date, time and place of birth. North Indian chart included.</p><span className="go">Create Kundli →</span><MiniChart /></Link>
          <Link to="/matchmaking" className="hx-tile hx-t-m"><span className="ic">💍</span><h3>Kundli matching</h3><p>Ashtakoota Guna Milan with Mangal dosha comparison, explained in plain words.</p><span className="go">Match now →</span></Link>
          <Link to="/chat-with-astrologer" className="hx-tile hx-t-3"><span className="ic">💬</span><h3>Chat or call</h3><p>Pick by language, topic and price per minute.</p><span className="go">Browse astrologers →</span></Link>
          <Link to="/horoscope/daily-horoscope" className="hx-tile hx-t-2"><span className="ic">♌</span><h3>Horoscope</h3><p>All 12 signs. Daily to yearly.</p><span className="go">Read →</span></Link>
          <Link to="/panchang/today-panchang" className="hx-tile hx-t-2"><span className="ic">🪔</span><h3>Panchang</h3><p>Tithi, Rahu Kaal, Hora.</p><span className="go">Today →</span></Link>
          <Link to="/atmakaraka-and-darakaraka-calculator" className="hx-tile hx-t-2"><span className="ic">🪐</span><h3>Atmakaraka &amp; Darakaraka</h3><p>Explore the Jaimini significators in your birth chart.</p><span className="go">Calculate →</span></Link>
          <Link to="/love-calculator" className="hx-tile hx-t-w"><span className="ic">🧮</span><h3>10 astrology calculators</h3><p>Explore love, numerology, signs, nakshatra, dasha and dosha tools.</p><span className="go">Open calculators →</span></Link>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="wrap hx-sec hx-rv">
        <div className="hx-head"><div><span className="hx-eyebrow">✦ Simple by design</span><h2>Three steps, <em>no jargon</em></h2></div></div>
        <div className="hx-steps">
          {[['Enter your birth details', 'Date, time and city. Don’t know the exact time? You can still generate a chart, just with less precision.'], ['See your chart explained', 'Planets, houses, dasha timeline and doshas, laid out so you can read it yourself.'], ['Ask a human, if you want', 'Take your chart to an astrologer who speaks your language and sets a price you can see upfront.']].map(([a, b]) => <div className="hx-step" key={a}><h3>{a}</h3><p>{b}</p></div>)}
        </div>
      </section>

      {/* ASTROLOGERS */}
      <section className="wrap hx-sec hx-rv">
        <div className="hx-head"><div><span className="hx-eyebrow">✦ Consult</span><h2>Talk to an <em>astrologer</em></h2><p>Filter by topic, language and price. Chat and call go live in the next phase; profiles below are demos until real astrologers are approved.</p></div><Link className="hx-more" to="/chat-with-astrologer">View all →</Link></div>
        {astros === null && <div className="agrid">{[1, 2, 3, 4].map(i => <div key={i} className="hx-skel" style={{ height: 230 }} />)}</div>}
        {astros && astros.length > 0 && <div className="agrid">{astros.map(a => <AstrologerCard key={a.slug} a={a} meta={meta} mode="chat" />)}</div>}
        {astros && astros.length === 0 && <div className="hx-empty"><p><b>Astrologers are being onboarded.</b></p><p>Are you an astrologer? Join us and set your own rates.</p><Link className="btn btn-gold sm" to="/astrologer-signup">Apply as astrologer</Link></div>}
        <div className="hx-cats" style={{ marginTop: 22 }}>{CATEGORIES.map((c, i) => { const sl = catSlug(c); return <Link key={c} className="hx-cat" to={sl ? `/astrologer/${sl}` : '/chat-with-astrologer'}><span>{CAT_ICONS[i % CAT_ICONS.length]}</span>{c}</Link> })}</div>
      </section>

      {/* HOROSCOPE */}
      <section className="hx-horo"><div className="wrap hx-rv">
        <div className="hx-head" style={{ marginBottom: 6 }}><div><span className="hx-eyebrow">✦ Horoscope</span><h2>Your stars, <em>your day</em></h2></div></div>
        <div className="tabs" role="tablist">{(['Today', 'Tomorrow', 'Week', 'Month'] as const).map(p => <button key={p} role="tab" aria-selected={p === period} className={p === period ? 'on' : ''} onClick={() => setPeriod(p)}>{p}</button>)}</div>
        <div className="signs">{SIGNS.map((x, i) => <button key={x[0]} className={'sign' + (i === sign ? ' on' : '')} onClick={() => setSign(i)}><span>{x[3]}</span>{x[0]}</button>)}</div>
        <div className="hx-panel hx-horo-card">
          <div className="hx-glyph"><span>{s[3]}</span><b>{s[0]}</b><small>{s[1]} · {s[2]}</small></div>
          <div>
            {horoBusy ? <div className="hx-skel" style={{ height: 120 }} /> : h ? <>
              <p className="horo-text" style={{ margin: 0 }}>{h.text.length > 420 ? h.text.slice(0, 420).trimEnd() + '…' : h.text}</p>
              <div className="hx-lucky">{h.mood && <span>Mood: <b>{h.mood}</b></span>}{h.luckyNumber !== null && <span>Lucky number: <b>{h.luckyNumber}</b></span>}{h.luckyColor && <span>Lucky colour: <b>{h.luckyColor}</b></span>}</div>
              <div className="bars">{bars.map(([k, v]) => v ? <div className="bar-row" key={k}><span>{k}</span><div className="bar" role="img" aria-label={`${k}: ${v} out of 5`}>{[1, 2, 3, 4, 5].map(n => <i key={n} className={n <= v ? 'on' : ''} />)}</div></div> : null)}</div>
            </> : <p className="muted" style={{ margin: 0 }}>{period === 'Today' ? 'Today’s' : `This ${period.toLowerCase()}’s`} reading for {s[0]} has not been published yet. Our editors write every horoscope by hand, so check back soon, or get a reading based on your own chart instead.</p>}
            <div className="row" style={{ marginTop: 16 }}><Link className="btn btn-gold sm" to={`/horoscope/${period === 'Week' ? 'weekly' : period === 'Month' ? 'monthly' : period === 'Tomorrow' ? 'tomorrow' : 'daily'}-horoscope/${s[0].toLowerCase()}`}>Full {s[0]} horoscope</Link><Link className="btn btn-line sm" to="/freekundli">Personal chart reading</Link></div>
          </div>
        </div>
      </div></section>

      {/* CALCULATORS */}
      <section className="wrap hx-sec hx-rv">
        <div className="hx-head"><div><span className="hx-eyebrow">✦ Quick tools</span><h2>Little tools, <em>big curiosity</em></h2></div><Link className="hx-more" to="/love-calculator">All calculators →</Link></div>
        <div className="hx-calcs">{CALCS.map(([slug, ic, n]) => <Link key={slug} to={'/' + slug} className="hx-calc"><i>{ic}</i>{n}</Link>)}</div>
      </section>

      {/* GLOSSARY */}
      <section className="wrap hx-sec hx-rv">
        <div className="hx-head"><div><span className="hx-eyebrow">✦ Vedic astrology 101</span><h2>Words you’ll see in <em>your chart</em></h2><p>A short, plain-language glossary so your Kundli never feels like a foreign language.</p></div></div>
        <div className="hx-gloss">{GLOSSARY.map(([t, sub, d]) => <article className="hx-gl" key={t}><h3>{t}<small>{sub}</small></h3><p>{d}</p></article>)}</div>
      </section>

      {/* PROMISES */}
      <section className="wrap hx-sec hx-rv">
        <div className="hx-head"><div><span className="hx-eyebrow">✦ Why people stay</span><h2>Built to be <em>trusted</em></h2></div></div>
        <div className="hx-promise">{PROMISES.map(([ic, t, d]) => <article className="hx-pr" key={t}><span className="ic">{ic}</span><h3>{t}</h3><p>{d}</p></article>)}</div>
      </section>

      {/* FAQ */}
      <section className="wrap hx-sec hx-rv">
        <div className="hx-head"><div><span className="hx-eyebrow">✦ FAQ</span><h2>Questions people ask <em>first</em></h2></div></div>
        {faq.map(([q, a]) => <details className="faq" key={q}><summary>{q}</summary><p>{a}</p></details>)}
        <p className="muted small" style={{ marginTop: 18 }}>Astrology is for guidance and reflection. It is not a substitute for medical, legal or financial advice.</p>
      </section>

      {/* FINAL CTA */}
      <section className="wrap hx-rv"><div className="hx-final">
        <h2>Your chart is already written. <em>Go read it.</em></h2>
        <p>It takes about a minute, costs nothing, and you can save it to your account for later.</p>
        <div className="row"><Link className="btn btn-gold" to="/freekundli">Make my free Kundli</Link><Link className="btn btn-line" to="/matchmaking">Match two Kundlis</Link></div>
      </div></section>
    </div>
  )
}
