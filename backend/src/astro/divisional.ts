import type { Kundli } from './engine.js'
import { SIGNS } from './data.js'

export const VARGAS = [1, 2, 3, 7, 9, 10, 12, 16, 20, 24, 27, 30, 60] as const
export type Varga = (typeof VARGAS)[number]

function divisionSign(sign: number, degree: number, n: Varga): number {
  const part = Math.min(n - 1, Math.floor(degree / (30 / n)))
  switch (n) {
    case 1: return sign
    case 2: return degree < 15 ? (sign % 2 === 0 ? 4 : 3) : (sign % 2 === 0 ? 3 : 4)
    case 3: return (sign + part * 4) % 12
    case 7: return (sign + (sign % 2 === 0 ? 0 : 6) + part) % 12
    case 9: return (sign + (sign % 3 === 0 ? 0 : sign % 3 === 1 ? 8 : 4) + part) % 12
    case 10: return (sign + (sign % 2 === 0 ? 0 : 8) + part) % 12
    case 12: return (sign + part) % 12
    case 16: return ((sign % 3 === 0 ? 0 : sign % 3 === 1 ? 4 : 8) + part) % 12
    case 20: return ((sign % 3 === 0 ? 0 : sign % 3 === 1 ? 8 : 4) + part) % 12
    case 24: return ((sign % 2 === 0 ? 4 : 3) + part) % 12
    case 27: return ((sign % 4) * 3 + part) % 12
    case 30: {
      // Parashara's unequal 30-part mapping for odd/even signs.
      const oddSign = sign % 2 === 0
      const starts = oddSign ? [0, 10, 8, 2, 6] : [1, 5, 11, 9, 7]
      const bounds = oddSign ? [5, 10, 18, 25, 30] : [5, 12, 20, 25, 30]
      let i = bounds.findIndex(edge => degree < edge)
      if (i < 0) i = 4
      return starts[i]
    }
    case 60: return (sign + (sign % 2 === 0 ? 0 : 6) + part) % 12
  }
}

/** Returns whole-sign divisional charts. D30 uses unequal classical segments. */
export function divisionalCharts(k: Kundli) {
  const points = [
    { name: 'Lagna', longitude: k.ascendant.longitude },
    ...k.planets.map(p => ({ name: p.name, longitude: p.longitude })),
  ]
  return VARGAS.map(varga => {
    const placements = points.map(point => {
      const longitude = ((point.longitude % 360) + 360) % 360
      const sign = Math.floor(longitude / 30)
      const degree = longitude - sign * 30
      return { name: point.name, sign: divisionSign(sign, degree, varga), signName: SIGNS[divisionSign(sign, degree, varga)] }
    })
    const ascendant = placements[0].sign
    const planets = placements.slice(1).map(p => ({ ...p, house: ((p.sign - ascendant + 12) % 12) + 1 }))
    const houses = Array.from({ length: 12 }, (_, i) => {
      const sign = (ascendant + i) % 12
      return { house: i + 1, sign, signName: SIGNS[sign], planets: planets.filter(p => p.house === i + 1).map(p => p.name) }
    })
    return { varga, name: varga === 1 ? 'D1 Rashi' : `D${varga}`, ascendant: { sign: ascendant, signName: SIGNS[ascendant] }, planets, houses }
  })
}
