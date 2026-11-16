import { Link, useLocation } from 'react-router-dom'
import { BRAND, t as titleCase } from '../data'
import { STATIC_DOCS } from '../content/legal'

const LABELS: Record<string, string> = {
  freekundli: 'Free Kundli',
  matchmaking: 'Kundli Matching',
  'panchang': 'Panchang',
  'festival': 'Festivals',
  'astrology-blog': 'Blog',
  'notification': 'Notifications',
  'my-wallet': 'Wallet',
  'customer-support': 'Customer Support Chat',
  'free-astrology-chat': 'Free Astrology Chat',
}

export const segmentLabel = (seg: string): string => LABELS[seg] ?? STATIC_DOCS[seg]?.title ?? titleCase(seg)

export default function Breadcrumbs() {
  const { pathname } = useLocation()
  const segs = pathname.split('/').filter(Boolean)
  if (segs.length === 0) return null
  const crumbs = segs.map((s, i) => ({ label: segmentLabel(s), to: '/' + segs.slice(0, i + 1).join('/') }))
  return (
    <nav className="crumbs wrap" aria-label="Breadcrumb">
      <ol>
        <li><Link to="/">{BRAND}</Link></li>
        {crumbs.map((c, i) => (
          <li key={c.to}>{i === crumbs.length - 1 ? <span aria-current="page">{c.label}</span> : <Link to={c.to}>{c.label}</Link>}</li>
        ))}
      </ol>
    </nav>
  )
}
