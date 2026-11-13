import { FRIENDSHIP, GANA, NADI, NAKSHATRAS, SIGNS, SIGN_LORDS, VARNA_NAME, VARNA_RANK, YONI, type Gana } from './data.js'

export interface MoonPlacement { sign: number; nakshatra: number }
export interface Koota { name: string; max: number; score: number | null; bride: string; groom: string; note: string }
export interface MatchResult {
  kootas: Koota[]
  total: number
  maxScored: number
  pending: string[]
  verdict: string
}

// Bride x Groom. One published table; sources disagree on the mixed cells, so this is a documented choice.
const GANA_TABLE: Record<Gana, Record<Gana, number>> = {
  Deva: { Deva: 6, Manushya: 6, Rakshasa: 0 },
  Manushya: { Deva: 5, Manushya: 6, Rakshasa: 0 },
  Rakshasa: { Deva: 1, Manushya: 0, Rakshasa: 6 },
}

const relScore = (a: string, b: string): number => {
  if (a === b) return 5
  const x = FRIENDSHIP[a][b], y = FRIENDSHIP[b][a]
  const set = [x, y].sort().join('')
  if (set === 'FF') return 5
  if (set === 'FN') return 4
  if (set === 'NN') return 3
  if (set === 'EF') return 1
  if (set === 'EN') return 0.5
  return 0
}

const taraGood = (from: number, to: number): boolean => {
  const count = ((to - from + 27) % 27) + 1
  const r = count % 9 || 9
  return ![3, 5, 7].includes(r)
}

export function ashtakoota(bride: MoonPlacement, groom: MoonPlacement): MatchResult {
  const bv = VARNA_NAME[bride.sign], gv = VARNA_NAME[groom.sign]
  const varna = VARNA_RANK[gv] >= VARNA_RANK[bv] ? 1 : 0

  const t1 = taraGood(bride.nakshatra, groom.nakshatra), t2 = taraGood(groom.nakshatra, bride.nakshatra)
  const tara = t1 && t2 ? 3 : t1 || t2 ? 1.5 : 0

  const bl = SIGN_LORDS[bride.sign], gl = SIGN_LORDS[groom.sign]
  const maitri = relScore(bl, gl)

  const bg = GANA[bride.nakshatra], gg = GANA[groom.nakshatra]
  const gana = GANA_TABLE[bg][gg]

  const d = ((groom.sign - bride.sign + 12) % 12) + 1
  const bad = [2, 12, 5, 9, 6, 8].includes(d)
  const bhakoot = bad ? 0 : 7

  const bn = NADI[bride.nakshatra], gn = NADI[groom.nakshatra]
  const nadi = bn === gn ? 0 : 8

  const kootas: Koota[] = [
    { name: 'Varna', max: 1, score: varna, bride: bv, groom: gv, note: 'Full point when the groom\'s varna is equal to or higher than the bride\'s.' },
    { name: 'Vashya', max: 2, score: null, bride: '', groom: '', note: 'Not scored yet: published Vashya tables disagree, so it is left out until a table is verified.' },
    { name: 'Tara', max: 3, score: tara, bride: NAKSHATRAS[bride.nakshatra], groom: NAKSHATRAS[groom.nakshatra], note: 'Birth-star count taken both ways, remainders 3, 5 and 7 (mod 9) are unfavourable.' },
    { name: 'Yoni', max: 4, score: null, bride: YONI[bride.nakshatra], groom: YONI[groom.nakshatra], note: 'Not scored yet: the full 14 x 14 animal table is not verified. The animals are shown for reference.' },
    { name: 'Graha Maitri', max: 5, score: maitri, bride: bl, groom: gl, note: 'Friendship between the lords of the two Moon signs.' },
    { name: 'Gana', max: 6, score: gana, bride: bg, groom: gg, note: 'Temperament match. Mixed combinations vary between traditions; one common table is used.' },
    { name: 'Bhakoot', max: 7, score: bhakoot, bride: SIGNS[bride.sign], groom: SIGNS[groom.sign], note: `Moon signs are ${d} apart counting from the bride${bad ? ' (2/12, 5/9 or 6/8 is unfavourable)' : ''}.` },
    { name: 'Nadi', max: 8, score: nadi, bride: bn, groom: gn, note: bn === gn ? 'Same Nadi (Nadi dosha) scores zero.' : 'Different Nadi.' },
  ]
  const scored = kootas.filter(k => k.score !== null)
  const total = scored.reduce((s, k) => s + (k.score as number), 0)
  const maxScored = scored.reduce((s, k) => s + k.max, 0)
  const pct = total / maxScored
  const verdict = pct >= 0.75 ? 'Very good match' : pct >= 0.6 ? 'Good match' : pct >= 0.5 ? 'Acceptable match' : 'Below the usual threshold'
  return { kootas, total, maxScored, pending: kootas.filter(k => k.score === null).map(k => k.name), verdict }
}
