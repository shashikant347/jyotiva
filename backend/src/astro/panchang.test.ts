import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as A from 'astronomy-engine'
import { computePanchang, elongation, karanaName, nextChange, tithiInfo } from './panchang.js'

const delhi = { latitude: 28.6139, longitude: 77.209, timezone: 'Asia/Kolkata' }
const mins = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5))

test('Delhi sunrise and sunset are in the expected range in mid-November and mid-June', () => {
  const nov = computePanchang({ date: '2026-11-13', ...delhi })
  assert.ok(mins(nov.sunrise.local) >= 6 * 60 + 40 && mins(nov.sunrise.local) <= 6 * 60 + 55, nov.sunrise.local)
  assert.ok(mins(nov.sunset.local) >= 17 * 60 + 20 && mins(nov.sunset.local) <= 17 * 60 + 35, nov.sunset.local)
  const jun = computePanchang({ date: '2026-06-21', ...delhi })
  assert.ok(mins(jun.sunrise.local) >= 5 * 60 + 18 && mins(jun.sunrise.local) <= 5 * 60 + 32, jun.sunrise.local)
  assert.ok(jun.dayLengthMinutes > 830 && jun.dayLengthMinutes < 845)
})

test('tithi at full moon: Purnima, and its end time matches the astronomical full moon', () => {
  const full = A.SearchMoonPhase(180, new Date('2026-03-01T00:00:00Z'), 10)!.date
  const before = new Date(full.getTime() - 3 * 3600_000)
  assert.equal(tithiInfo(Math.floor(elongation(before) / 12)).name, 'Shukla Purnima')
  const end = nextChange(d => Math.floor(elongation(d) / 12), before)
  assert.ok(Math.abs(end.getTime() - full.getTime()) < 120_000, `${end.toISOString()} vs ${full.toISOString()}`)
})

test('tithi at new moon is Amavasya', () => {
  const nm = A.SearchMoonPhase(0, new Date('2026-02-10T00:00:00Z'), 10)!.date
  assert.equal(tithiInfo(Math.floor(elongation(new Date(nm.getTime() - 3600_000)) / 12)).name, 'Krishna Amavasya')
})

test('karana sequence', () => {
  assert.equal(karanaName(0), 'Kimstughna')
  assert.equal(karanaName(1), 'Bava')
  assert.equal(karanaName(7), 'Vishti (Bhadra)')
  assert.equal(karanaName(8), 'Bava')
  assert.deepEqual([57, 58, 59].map(karanaName), ['Shakuni', 'Chatushpada', 'Naga'])
})

test('weekday periods: Rahu Kaal slots and ordering', () => {
  // Monday 2026-11-09 and Sunday 2026-11-08
  const mon = computePanchang({ date: '2026-11-09', ...delhi })
  assert.equal(mon.weekday, 'Monday')
  const eighth = (mon.dayLengthMinutes) / 8
  const rs = (new Date(mon.rahuKaal.start.iso).getTime() - new Date(mon.sunrise.iso).getTime()) / 60000
  assert.ok(Math.abs(rs - eighth) < 0.1, 'Monday Rahu Kaal is the 2nd eighth')
  const sun = computePanchang({ date: '2026-11-08', ...delhi })
  assert.equal(sun.weekday, 'Sunday')
  assert.equal(sun.rahuKaal.end.iso, sun.sunset.iso) // Sunday: last eighth
  for (const p of [mon.rahuKaal, mon.yamaganda, mon.gulika, mon.abhijit]) assert.ok(p.start.iso < p.end.iso)
})

test('choghadiya and hora', () => {
  const sun = computePanchang({ date: '2026-11-08', ...delhi })
  assert.deepEqual(sun.choghadiya.map(c => c.name), ['Udveg', 'Chara', 'Labh', 'Amrit', 'Kaal', 'Shubh', 'Rog', 'Udveg'])
  const mon = computePanchang({ date: '2026-11-09', ...delhi })
  assert.deepEqual(mon.choghadiya.slice(0, 3).map(c => c.name), ['Amrit', 'Kaal', 'Shubh'])
  assert.equal(sun.hora.length, 24)
  assert.equal(sun.hora[0].lord, 'Sun'); assert.equal(sun.hora[1].lord, 'Venus'); assert.equal(sun.hora[7].lord, 'Sun')
  assert.equal(mon.hora[0].lord, 'Moon')
  for (let i = 1; i < 12; i++) assert.equal(sun.hora[i].start.iso, sun.hora[i - 1].end.iso)
  assert.equal(sun.hora[11].end.iso, sun.sunset.iso)
  assert.equal(sun.hora[12].start.iso, sun.sunset.iso)
})

test('Panchang elements are consistent', () => {
  const p = computePanchang({ date: '2026-11-13', ...delhi })
  assert.equal(p.weekday, 'Friday')
  assert.ok(p.tithi.number >= 1 && p.tithi.number <= 30)
  assert.ok(p.tithi.endsAt.iso > p.sunrise.iso)
  assert.ok(new Date(p.tithi.endsAt.iso).getTime() - new Date(p.sunrise.iso).getTime() < 28 * 3600_000)
  assert.ok(p.nakshatra.pada >= 1 && p.nakshatra.pada <= 4)
})
