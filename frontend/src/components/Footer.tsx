import { Link } from 'react-router-dom'
import { BRAND } from '../data'
const cols: [string, [string, string][]][] = [
  ['Horoscope', [['Daily','/horoscope/daily-horoscope'],['Weekly','/horoscope/weekly-horoscope'],['Monthly','/horoscope/monthly-horoscope'],['Yearly','/horoscope/yearly-horoscope']]],
  ['Free tools', [['Free Kundli','/freekundli'],['Kundli Matching','/matchmaking'],['Love Calculator','/love-calculator'],['Tarot','/tarot']]],
  ['Panchang', [['Today','/panchang/today-panchang'],['Rahu Kaal','/panchang/rahu-kaal'],['Choghadiya','/panchang/choghadiya'],['Festivals','/festival']]],
  ['Company', [['About us','/about-us'],['Terms','/terms-and-conditions'],['Privacy','/privacy-policies'],['Refund policy','/refund-and-cancellation-policy'],['Disclaimer','/disclaimer'],['Astrologer sign up','/astrologer-signup']]],
]
export default function Footer() {
  return (
    <footer className="ftr"><div className="wrap">
      <div className="ftr-grid">{cols.map(([h, ls]) => (<div key={h}><h4>{h}</h4>{ls.map(([l, to]) => <Link key={to} to={to}>{l}</Link>)}</div>))}</div>
      <p className="muted small">Astrology is offered for guidance and reflection, not as medical, legal or financial advice. © 2026 {BRAND}.</p>
    </div></footer>
  )
}
