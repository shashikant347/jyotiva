import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as c from './calculators.js'

test('name numerology uses the Pythagorean system', () => {
  assert.equal(c.reduce(38), 2)
  assert.equal(c.reduce(9), 9)
  assert.deepEqual(c.nameNumber('Abc'), { total: 6, number: 6 })
  assert.throws(() => c.nameNumber('1234'), c.CalcError)
})

test('love score is deterministic and capped', () => {
  const score = c.love('Ram', 'Sita').percent
  assert.equal(score, c.love('Ram', 'Sita').percent)
  assert.ok(score >= 0 && score <= 100)
  const first = 'T'.repeat(400) + 'R'.repeat(400) + 'U'.repeat(400) + 'E'.repeat(400) + 'L'.repeat(400) + 'O'.repeat(400) + 'V'.repeat(400)
  assert.throws(() => c.love(first, 'TRUELOVE'), c.CalcError)
})
