import type { DivisionalChart } from './types'

const ABBR: Record<string, string> = { Lagna: 'As', Sun: 'Su', Moon: 'Mo', Mars: 'Ma', Mercury: 'Me', Jupiter: 'Ju', Venus: 'Ve', Saturn: 'Sa', Rahu: 'Ra', Ketu: 'Ke' }
// South Indian chart: signs stay in a fixed clockwise order, starting with Aries.
const CELLS: [number, number][] = [[0,0],[0,1],[0,2],[0,3],[1,3],[2,3],[3,3],[3,2],[3,1],[3,0],[2,0],[1,0]]

export default function SouthChart({ chart, label }: { chart: DivisionalChart; label: string }) {
  const positions = chart.houses.map(h => ({ ...h, row: CELLS[h.sign][0], col: CELLS[h.sign][1] }))
  return <svg viewBox="0 0 400 400" className="chart" role="img" aria-label={label}>
    {positions.map(h => <g key={h.sign}>
      <rect x={h.col * 100 + 1} y={h.row * 100 + 1} width="98" height="98" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <text x={h.col * 100 + 8} y={h.row * 100 + 20} className="chart-sign">{h.signName}</text>
      <text x={h.col * 100 + 50} y={h.row * 100 + 48} textAnchor="middle" className="chart-pl">{h.planets.map(p => ABBR[p] ?? p).join(' ')}</text>
      {h.sign === chart.ascendant.sign && <text x={h.col * 100 + 50} y={h.row * 100 + 82} textAnchor="middle" className="chart-lag">As</text>}
    </g>)}
    <rect x="101" y="101" width="198" height="198" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <text x="200" y="190" textAnchor="middle" className="chart-lag">{chart.name}</text>
    <text x="200" y="216" textAnchor="middle" className="chart-sign">Lagna {chart.ascendant.signName}</text>
  </svg>
}
