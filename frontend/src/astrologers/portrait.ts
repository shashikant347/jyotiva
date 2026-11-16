// Original illustrated avatar, generated from the slug. Used while a profile has no uploaded photo.
// Only fixed palettes and numbers from a hash go into the SVG, so the markup is safe to inject.
const SKIN = ['#f1c9a5', '#e0a97c', '#c98b5e', '#a8693f', '#8a5230']
const HAIR = ['#1b1512', '#2a1d16', '#3b2a20', '#5a4636', '#d8d4cc']
const CLOTH = ['#f2f2ee', '#e8742a', '#c23a4a', '#2f5fa8', '#1f8a6b', '#7a3fa0', '#f0b429', '#2b2f3a']
const BG = ['#fff1d6', '#e6f2ff', '#fde4ec', '#e4f6ea', '#efe6ff', '#fff3e0']

const hash = (s: string): number => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) } return h >>> 0 }
const pick = <T,>(a: T[], h: number, shift: number): T => a[(h >>> shift) % a.length]

export function portraitSvg(slug: string, gender: 'male' | 'female' | 'other' = 'male'): string {
  const h = hash(slug)
  const skin = pick(SKIN, h, 0), hair = pick(HAIR, h, 3), cloth = pick(CLOTH, h, 6), bg = pick(BG, h, 9)
  const female = gender === 'female'
  const old = ((h >>> 12) % 3) === 0
  const hairCol = old && !female ? '#d8d4cc' : hair
  const turban = !female && ((h >>> 14) % 4) === 0
  const beard = !female && !turban && ((h >>> 16) % 2) === 0
  const glasses = ((h >>> 18) % 4) === 0
  const tilak = ((h >>> 20) % 2) === 0
  const bindi = female
  const parts: string[] = []
  parts.push(`<rect width="100" height="100" fill="${bg}"/>`)
  if (female) parts.push(`<path d="M24 60C20 28 34 14 50 14s30 14 26 46c-2 16-6 24-6 24H30s-4-8-6-24z" fill="${hairCol}"/>`)
  parts.push(`<path d="M14 100c2-20 16-28 36-28s34 8 36 28z" fill="${cloth}"/>`)
  if (!female) parts.push(`<path d="M42 72l8 12 8-12" fill="none" stroke="rgba(0,0,0,.18)" stroke-width="2"/>`)
  parts.push(`<rect x="43" y="60" width="14" height="16" rx="6" fill="${skin}"/>`)
  parts.push(`<ellipse cx="50" cy="44" rx="19" ry="22" fill="${skin}"/>`)
  parts.push(`<ellipse cx="31.5" cy="46" rx="3" ry="5" fill="${skin}"/><ellipse cx="68.5" cy="46" rx="3" ry="5" fill="${skin}"/>`)
  if (turban) parts.push(`<path d="M28 38c0-16 10-24 22-24s22 8 22 24c-8-6-14-8-22-8s-14 2-22 8z" fill="${pick(CLOTH, h, 22)}"/><path d="M30 34c12-6 28-6 40 0" stroke="rgba(255,255,255,.35)" stroke-width="2" fill="none"/>`)
  else if (female) parts.push(`<path d="M30 42c0-16 8-24 20-24s20 8 20 24c-6-8-12-12-20-12S36 34 30 42z" fill="${hairCol}"/>`)
  else parts.push(`<path d="M31 38c0-14 8-21 19-21s19 7 19 21c-4-6-9-9-19-9s-15 3-19 9z" fill="${hairCol}"/>`)
  if (beard) parts.push(`<path d="M32 50c2 16 10 24 18 24s16-8 18-24c-3 6-8 8-18 8s-15-2-18-8z" fill="${hairCol}"/>`)
  parts.push(`<circle cx="42.5" cy="45" r="2.1" fill="#2a1d16"/><circle cx="57.5" cy="45" r="2.1" fill="#2a1d16"/>`)
  if (glasses) parts.push(`<g fill="none" stroke="#2a1d16" stroke-width="1.6"><circle cx="42.5" cy="45" r="5.5"/><circle cx="57.5" cy="45" r="5.5"/><path d="M48 45h4"/></g>`)
  parts.push(`<path d="M43 56c4 3.6 10 3.6 14 0" fill="none" stroke="${beard ? '#f2d6c0' : '#8a3b2e'}" stroke-width="2" stroke-linecap="round"/>`)
  if (tilak && !female) parts.push(`<path d="M50 29v8" stroke="#d6382b" stroke-width="2.6" stroke-linecap="round"/>`)
  if (bindi) parts.push(`<circle cx="50" cy="35" r="2" fill="#d6382b"/>`)
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">${parts.join('')}</svg>`
}
