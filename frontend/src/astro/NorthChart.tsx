import type { KundliResult } from './types'

const ABBR: Record<string, string> = { Sun: 'Su', Moon: 'Mo', Mars: 'Ma', Mercury: 'Me', Jupiter: 'Ju', Venus: 'Ve', Saturn: 'Sa', Rahu: 'Ra', Ketu: 'Ke' }

// North Indian chart: houses are fixed in place, the sign numbers move. House 1 is the top diamond.
// Coordinates are label positions (sign number, planets) inside a 400 x 400 square.
const POS: [number, number, number, number][] = [
  [200, 90, 200, 125], [100, 40, 100, 70], [40, 100, 70, 130], [100, 200, 130, 200], [40, 300, 70, 330], [100, 360, 100, 390],
  [200, 310, 200, 345], [300, 360, 300, 390], [360, 300, 330, 330], [300, 200, 270, 200], [360, 100, 330, 130], [300, 40, 300, 70],
]

export default function NorthChart({ k, label }: { k: KundliResult['kundli']; label: string }) {
  return (
    <svg viewBox="0 0 400 400" className="chart" role="img" aria-label={label}>
      <rect x="2" y="2" width="396" height="396" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M2 2 L398 398 M398 2 L2 398 M200 2 L398 200 L200 398 L2 200 Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
      {k.houses.map((h, i) => {
        const [sx, sy, px, py] = POS[i]
        return (
          <g key={h.house}>
            <text x={sx} y={sy} textAnchor="middle" className="chart-sign">{h.sign + 1}</text>
            <text x={px} y={py} textAnchor="middle" className="chart-pl">
              {h.planets.map((p, j) => <tspan key={p} x={px} dy={j === 0 ? 0 : 15}>{ABBR[p]}</tspan>)}
            </text>
          </g>
        )
      })}
      <text x="200" y="196" textAnchor="middle" className="chart-lag">Lagna</text>
    </svg>
  )
}
