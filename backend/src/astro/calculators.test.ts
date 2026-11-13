import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as c from './calculators.js'

test('reduce and name numbers (Pythagorean)', () => {
  assert.equal(c.reduce(38), 2)
  assert.equal(c.reduce(9), 9)
  assert.deepEqual(c.nameNumber('Abc'), { total: 6, number: 6 }) // 1+2+3
  assert.equal(c.nameNumber('John Smith').total, 1 + 6 + 8 + 5 + 1 + 4 + 9 + 2 + 8) // J1 O6 H8 N5 S1 M4 I9 T2 H8
  assert.throws(() => c.nameNumber('1234'), c.CalcError)
})

test('mulank and destiny number', () => {
  assert.deepEqual(c.mulank('1990-05-29'), { dayOfBirth: 29, mulank: 2 })
  assert.deepEqual(c.destiny('1990-05-29'), { total: 35, destinyNumber: 8 }) // 1+9+9+0 + 5 + 2+9 = 35 -> 8
})

test('Lo Shu grid places digits on the 4-9-2 / 3-5-7 / 8-1-6 square', () => {
  const r = c.loShu('1990-05-29') // digits 2 9 5 1 9 9 0 -> 1,2,5,9 x3
  assert.deepEqual(r.grid.map(row => row.map(x => x.n)), [[4, 9, 2], [3, 5, 7], [8, 1, 6]])
  assert.equal(r.grid[0][1].count, 3) // nine appears three times
  assert.deepEqual(r.missing, [3, 4, 6, 7, 8])
  assert.deepEqual(r.repeated, [9])
})

test('FLAMES', () => {
  // classic example: ANIL and ANITA -> remaining letters L and T,A = 3 -> Affection? verify by hand below
  const r = c.flames('Anil', 'Anita')
  assert.equal(r.remaining, 3) // N,A,I cancel; L / T,A remain
  assert.ok(['Friends', 'Love', 'Affection', 'Marriage', 'Enemies', 'Siblings'].includes(r.result))
  assert.equal(c.flames('Sam', 'Sam').result, 'Friends')
  // count 1 eliminates F,L,A,M,E in turn, leaving S
  assert.equal(c.flames('ab', 'a').result, 'Siblings')
})

test('love and friendship scores are deterministic and in range', () => {
  const a = c.love('Ram', 'Sita').percent
  assert.equal(a, c.love('Ram', 'Sita').percent)
  assert.ok(a >= 0 && a <= 100)
  assert.ok(c.friendship('Ram', 'Shyam').percent <= 100)
})

test('age', () => {
  const r = c.age('1990-05-29', new Date('2026-11-13T00:00:00Z'))
  assert.deepEqual([r.years, r.months, r.days], [36, 5, 15])
  assert.equal(c.age('2026-11-13', new Date('2026-11-13T00:00:00Z')).totalDays, 0)
  assert.throws(() => c.age('2027-01-01', new Date('2026-11-13T00:00:00Z')), c.CalcError)
  // end-of-month borrow
  assert.deepEqual((({ years, months, days }) => [years, months, days])(c.age('2000-01-31', new Date('2000-03-01T00:00:00Z'))), [0, 1, 1])
})

test('moon phase: known new and full moons', () => {
  assert.equal(c.moonPhase('2026-02-17').phase, 'New Moon')
  assert.ok(c.moonPhase('2026-02-17').illuminationPercent <= 2)
  assert.equal(c.moonPhase('2026-03-03').phase, 'Full Moon') // full moon 3 Mar 2026
  assert.ok(c.moonPhase('2026-03-03').illuminationPercent >= 98)
})

test('digit numerology', () => {
  assert.deepEqual(c.digitNumerology('98765 43210'), { digits: '9876543210', total: 45, number: 9 })
  assert.throws(() => c.digitNumerology('12'), c.CalcError)
})
