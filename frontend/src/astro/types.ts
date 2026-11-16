export interface PlaceHit { name: string; state: string; latitude: number; longitude: number; timezone: string }
export interface Birth { name: string; birthDate: string; birthTime: string | null; latitude: number; longitude: number; timezone: string }
export interface PlanetPos { name: string; longitude: number; sign: number; signName: string; degree: number; nakshatraName: string; pada: number; retrograde: boolean; house: number }
export interface DashaPeriod { lord: string; start: string; end: string; sub?: DashaPeriod[] }
export interface DivisionalChart {
  varga: number; name: string; ascendant: { sign: number; signName: string }
  planets: { name: string; sign: number; signName: string; house: number }[]
  houses: { house: number; sign: number; signName: string; planets: string[] }[]
}
export interface KundliResult {
  name: string | null
  timeUnknown: boolean
  warnings: string[]
  kundli: {
    utc: string; ayanamsa: number
    ascendant: { sign: number; signName: string; degree: number; nakshatraName: string; pada: number }
    planets: PlanetPos[]
    houses: { house: number; sign: number; signName: string; planets: string[] }[]
    divisionalCharts?: DivisionalChart[]
  }
  moon: { signName: string; nakshatraName: string; pada: number }
  dasha: DashaPeriod[]
  doshas: {
    mangal: { present: boolean; fromLagna: boolean; fromMoon: boolean; marsHouseFromLagna: number; marsHouseFromMoon: number; note: string }
    kaalSarp: { present: boolean; note: string }
    sadeSati: { active: boolean; phase: string | null; saturnSign: string; moonSign: string; asOf: string }
  }
  method: { zodiac: string; houses: string; nodes: string; ephemeris: string }
}
export interface Koota { name: string; max: number; score: number | null; bride: string; groom: string; note: string }
export interface MatchResult {
  bride: { name: string | null; moonSign: string; nakshatra: string; pada: number; mangal: boolean }
  groom: { name: string | null; moonSign: string; nakshatra: string; pada: number; mangal: boolean }
  kootas: Koota[]; total: number; maxScored: number; pending: string[]; verdict: string; warnings: string[]
}
