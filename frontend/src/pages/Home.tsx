import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ASTROLOGERS, CATEGORIES, FAQ, SIGNS } from '../data'

const ICONS = ['💖','💍','💼','💰','🩺','🔮','📿','🌿','🔢','✋','🎴','🏠','🧿']

function Wheel() {
  return (
    <svg viewBox="-100 -100 200 200" className="wheel" role="img" aria-label="Zodiac wheel">
      {[92, 70, 46, 22].map(r => <circle key={r} r={r} fill="none" stroke="currentColor" strokeWidth={r === 92 ? 1.5 : 0.7} />)}
      {SIGNS.map((s, i) => { const a = (i * 30 - 75) * Math.PI / 180; return (
        <g key={s[0]}><line x1={46 * Math.cos(a - .26)} y1={46 * Math.sin(a - .26)} x2={92 * Math.cos(a - .26)} y2={92 * Math.sin(a - .26)} stroke="currentColor" strokeWidth=".6" />
        <text x={81 * Math.cos(a)} y={81 * Math.sin(a)} textAnchor="middle" dominantBaseline="central" fontSize="11" fill="currentColor">{s[3]}</text></g>) })}
      <circle r="9" className="sun" />
    </svg>
  )
}

export default function Home() {
  const [sign, setSign] = useState(0)
  const [period, setPeriod] = useState('Today')
  const s = SIGNS[sign]
  return (
    <>
      <section className="hero"><div className="wrap hero-in">
        <div>
          <h1>Talk to astrologers who read your <em>birth chart</em></h1>
          <ul className="ticks"><li>Free detailed Kundli in a minute</li><li>Choose by language, topic and price</li></ul>
          <div className="row"><Link className="btn btn-gold" to="/free-astrology-chat">Start free chat</Link><Link className="btn btn-line" to="/freekundli">Make free Kundli</Link></div>
          <div className="stats">{[['24','Free calculators'],['12','Daily horoscopes'],['Chat + Call','Consult your way']].map(([n, l]) => <div key={l}><b>{n}</b><span>{l}</span></div>)}</div>
        </div>
        <div className="art"><Wheel /><span className="float f1">Free first chat</span><span className="float f2">Kundli in 60 sec</span></div>
      </div></section>

      <section className="wrap sec"><div className="quick">
        {[['Chat with astrologer','Text consultation','/chat-with-astrologer'],['Call astrologer','Voice consultation','/talk-to-astrologer'],['Daily horoscope','All 12 signs','/horoscope/daily-horoscope'],['Free Kundli','Birth chart and doshas','/freekundli'],['Kundli matching','Guna Milan out of 36','/matchmaking'],['Panchang','Tithi, muhurat, Rahu Kaal','/panchang/today-panchang']].map(([a, b, to]) => (
          <Link key={to} to={to} className="card"><strong>{a}</strong><span className="muted">{b}</span></Link>))}</div></section>

      <section className="wrap sec">
        <div className="sec-h"><h2>Talk to top rated <em>astrologers</em></h2><Link to="/chat-with-astrologer">View all</Link></div>
        <p className="muted small">Sample profiles for layout only.</p>
        <div className="grid4">{ASTROLOGERS.map(a => (
          <article className="card astro" key={a.name}>
            <div className="avatar" aria-hidden>{a.name.split(' ').pop()![0]}</div>
            <h3>{a.name}{a.badge && <span className="badge">{a.badge}</span>}</h3>
            <p className="muted small">{a.skills}<br />{a.langs} · {a.exp} yrs</p>
            <p><b>★ {a.rating}</b> · ₹{a.price}/min · <span className={a.online ? 'on' : 'off'}>{a.online ? 'Online' : 'Busy'}</span></p>
            <div className="row"><button className="btn btn-gold sm">Chat</button><button className="btn btn-line sm">Call</button></div>
          </article>))}</div>
      </section>

      <section className="wrap sec">
        <h2>Find the right astrologer, <em>for you</em></h2>
        <div className="cats">{CATEGORIES.map((c, i) => <Link key={c} className="cat" to="/chat-with-astrologer"><span className="ico">{ICONS[i % ICONS.length]}</span>{c}<b>›</b></Link>)}</div>
      </section>

      <section className="band"><div className="wrap sec">
        <h2>Your daily <em>horoscope</em></h2>
        <div className="tabs" role="tablist">{['Today','Tomorrow','Week','Month'].map(p => <button key={p} role="tab" aria-selected={p === period} className={p === period ? 'on' : ''} onClick={() => setPeriod(p)}>{p}</button>)}</div>
        <div className="signs">{SIGNS.map((x, i) => <button key={x[0]} className={'sign' + (i === sign ? ' on' : '')} onClick={() => setSign(i)}><span>{x[3]}</span>{x[0]}</button>)}</div>
        <div className="card hscope">
          <h3>{s[0]} <span className="muted">({s[1]}) · {s[2]}</span></h3>
          <p>{period} reading goes here. Sample text: keep plans simple, finish what is pending, and avoid big money decisions on impulse.</p>
          <div className="meters">{['Love','Career','Health','Money'].map((m, i) => <div key={m}><small>{m}</small><i style={{ width: 55 + ((sign + i * 3) % 4) * 11 + '%' }} /></div>)}</div>
          <Link className="btn btn-gold sm" to={`/horoscope/daily-horoscope/${s[0].toLowerCase()}`}>Read full horoscope</Link>
        </div>
      </div></section>

      <section className="wrap sec quote">
        <div><h2>Real people. <em>Real reviews.</em></h2><p className="lead">Sample review shown for layout. Real reviews will appear once users rate their sessions.</p></div>
        <div className="qcard"><div className="stars">★★★★★</div><p>“The astrologer explained my chart patiently and gave me clear next steps instead of vague predictions.”</p><b>Sample user</b><br /><span className="muted small">City, India</span></div>
      </section>

      <section className="wrap sec">
        <h2>Questions people ask first</h2>
        {FAQ.map(([q, a]) => <details className="faq" key={q}><summary>{q}</summary><p>{a}</p></details>)}
      </section>
    </>
  )
}
