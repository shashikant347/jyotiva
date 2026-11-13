import assert from 'node:assert/strict'
import { test } from 'node:test'
import { computeKundli, doshas, lahiriAyanamsa, tzOffsetHours, vimshottari, type BirthInput } from './engine.js'
import { ashtakoota } from './matching.js'

const delhi = (date: string, time: string): BirthInput => ({ date, time, tzOffset: 5.5, lat: 28.6139, lon: 77.209 })
const jdOf = (iso: string) => new Date(iso).getTime() / 86400_000 + 2440587.5
const sun = (k: ReturnType<typeof computeKundli>) => k.planets.find(p => p.name === 'Sun')!
const near = (a: number, b: number, tol: number, msg: string) => assert.ok(Math.abs(((a - b + 540) % 360) - 180) <= tol, `${msg}: ${a.toFixed(3)} vs ${b}`)

test('Lahiri ayanamsa matches published values', () => {
  near(lahiriAyanamsa(jdOf('2000-01-01T12:00:00Z')), 23.853, 0.01, 'J2000')
  near(lahiriAyanamsa(jdOf('1950-01-01T00:00:00Z')), 23.15, 0.05, '1950')
  near(lahiriAyanamsa(jdOf('2026-01-01T00:00:00Z')), 24.2, 0.05, '2026')
})

test('sidereal Sun is at the start of Makara around Makar Sankranti 2026 and Mesha around mid April', () => {
  near(sun(computeKundli({ ...delhi('2026-01-14', '12:00'), tzOffset: 0 })).longitude, 270, 1, 'Jan 14 2026')
  near(sun(computeKundli({ ...delhi('2026-04-14', '12:00'), tzOffset: 0 })).longitude, 0, 1, 'Apr 14 2026')
})

test('new moon: Sun and Moon are conjunct (17 Feb 2026 ~12:01 UTC)', () => {
  const k = computeKundli({ ...delhi('2026-02-17', '12:01'), tzOffset: 0 })
  const moon = k.planets.find(p => p.name === 'Moon')!
  near(moon.longitude, sun(k).longitude, 1, 'elongation')
})

test('ascendant is close to the Sun at sunrise (Delhi, 21 Mar 2026 ~06:25 IST)', () => {
  const k = computeKundli(delhi('2026-03-21', '06:25'))
  near(k.ascendant.longitude, sun(k).longitude, 4, 'asc vs sun')
  const k2 = computeKundli(delhi('2026-03-21', '18:45')) // about sunset: ascendant is opposite the Sun
  near(k2.ascendant.longitude, sun(k2).longitude + 180, 5, 'asc vs sun at sunset')
})

test('chart structure is consistent', () => {
  const k = computeKundli(delhi('1990-05-17', '14:30'))
  assert.equal(k.planets.length, 9)
  const rahu = k.planets.find(p => p.name === 'Rahu')!, ketu = k.planets.find(p => p.name === 'Ketu')!
  near(rahu.longitude, ketu.longitude + 180, 0.0001, 'rahu/ketu opposite')
  assert.ok(k.planets.every(p => p.house >= 1 && p.house <= 12 && p.pada >= 1 && p.pada <= 4 && p.degree >= 0 && p.degree < 30))
  assert.equal(k.houses.reduce((n, h) => n + h.planets.length, 0), 9)
  assert.equal(k.houses[0].sign, k.ascendant.sign)
})

test('Mercury and Venus stay within their maximum elongation from the Sun', () => {
  for (const d of ['2024-03-01', '2025-07-15', '2026-09-09']) {
    const k = computeKundli(delhi(d, '10:00'))
    const s = sun(k).longitude
    near(k.planets.find(p => p.name === 'Mercury')!.longitude, s, 29, 'Mercury')
    near(k.planets.find(p => p.name === 'Venus')!.longitude, s, 48, 'Venus')
  }
})

test('Vimshottari: contiguous periods, 120-year cycle, first lord from the Moon nakshatra', () => {
  const k = computeKundli(delhi('1990-05-17', '14:30'))
  const moon = k.planets.find(p => p.name === 'Moon')!
  const d = vimshottari(moon.longitude, new Date(k.utc))
  assert.equal(d.length, 9)
  assert.equal(d[0].lord, ['Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury'][moon.nakshatra % 9])
  assert.equal(d[0].start, k.utc)
  for (let i = 1; i < d.length; i++) assert.equal(d[i].start, d[i - 1].end)
  const years = (new Date(d[8].end).getTime() - new Date(d[0].start).getTime()) / (365.25 * 86400_000)
  assert.ok(years > 100 && years <= 120, `span ${years}`)
  for (const [idx, p] of d.entries()) {
    // The first period is already partly elapsed at birth, so only its remaining sub-periods are listed.
    if (idx === 0) assert.ok(p.sub!.length >= 1 && p.sub!.length <= 9)
    else assert.equal(p.sub!.length, 9)
    assert.equal(p.sub![0].start, p.start)
    assert.equal(p.sub![p.sub!.length - 1].end, p.end)
    for (let i = 1; i < p.sub!.length; i++) assert.equal(p.sub![i].start, p.sub![i - 1].end)
  }
})

test('Mangal dosha follows the house rule', () => {
  const k = computeKundli(delhi('1990-05-17', '14:30'))
  const mars = k.planets.find(p => p.name === 'Mars')!
  const r = doshas(k, new Date('2026-11-13T00:00:00Z'))
  assert.equal(r.mangal.marsHouseFromLagna, mars.house)
  assert.equal(r.mangal.fromLagna, [1, 2, 4, 7, 8, 12].includes(mars.house))
})

test('Sade Sati: active only when Saturn is in the 12th, 1st or 2nd sign from the Moon', () => {
  const k = computeKundli(delhi('1990-05-17', '14:30'))
  const moonSign = k.planets.find(p => p.name === 'Moon')!.sign
  const r = doshas(k, new Date('2026-11-13T00:00:00Z'))
  const satSign = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'].indexOf(r.sadeSati.saturnSign)
  assert.equal(r.sadeSati.active, [11, 0, 1].includes((satSign - moonSign + 12) % 12))
})

test('time zone offsets', () => {
  assert.equal(tzOffsetHours('Asia/Kolkata', '1990-05-17', '14:30'), 5.5)
  assert.equal(tzOffsetHours('America/New_York', '2026-07-01', '12:00'), -4)
  assert.equal(tzOffsetHours('America/New_York', '2026-01-01', '12:00'), -5)
})

test('Ashtakoota: identical Moon placements', () => {
  const m = { sign: 3, nakshatra: 8 } // Cancer, Ashlesha
  const r = ashtakoota(m, m)
  const s = Object.fromEntries(r.kootas.map(k => [k.name, k.score]))
  assert.deepEqual(s, { Varna: 1, Vashya: null, Tara: 3, Yoni: null, 'Graha Maitri': 5, Gana: 6, Bhakoot: 7, Nadi: 0 })
  assert.equal(r.total, 22)
  assert.equal(r.maxScored, 30)
  assert.deepEqual(r.pending, ['Vashya', 'Yoni'])
})

test('Ashtakoota: Bhakoot, Nadi and Tara rules', () => {
  // Aries (0) bride, Virgo (5) groom: 6th from bride -> bhakoot dosha
  const bad = ashtakoota({ sign: 0, nakshatra: 0 }, { sign: 5, nakshatra: 1 })
  assert.equal(bad.kootas.find(k => k.name === 'Bhakoot')!.score, 0)
  // Ashwini (Adi) vs Bharani (Madhya): different nadi
  assert.equal(bad.kootas.find(k => k.name === 'Nadi')!.score, 8)
  // Tara: bride Ashwini(0), groom Krittika(2): count 3 (Vipat) one way -> one direction bad
  const t = ashtakoota({ sign: 0, nakshatra: 0 }, { sign: 0, nakshatra: 2 })
  assert.equal(t.kootas.find(k => k.name === 'Tara')!.score, 1.5)
  // Varna: bride Brahmin (Cancer), groom Shudra (Gemini) -> 0
  const v = ashtakoota({ sign: 3, nakshatra: 7 }, { sign: 2, nakshatra: 5 })
  assert.equal(v.kootas.find(k => k.name === 'Varna')!.score, 0)
})
