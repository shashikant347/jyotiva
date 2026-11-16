import assert from 'node:assert/strict'
import test from 'node:test'
import { Syncer, type DocStore } from './persist.js'

const KEYS = { users: 'id', wallets: 'userId', tags: null }

/** A fake document database kept in a Map. */
function fake() {
  const data: Record<string, Map<string, Record<string, unknown>>> = { users: new Map(), wallets: new Map(), tags: new Map() }
  const writes: string[] = []
  const store: DocStore = {
    async loadAll(names) { return Object.fromEntries(names.map(n => [n, [...data[n].values()]])) },
    async apply(name, ups, dels) { for (const d of ups) data[name].set(String(d._id), d); for (const id of dels) data[name].delete(id); writes.push(`${name}:+${ups.length}-${dels.length}`) },
  }
  return { data, writes, store }
}

test('first flush writes everything, second flush writes nothing', async () => {
  const f = fake(), s = new Syncer(f.store, KEYS)
  await s.load()
  const db = { users: [{ id: 'u1', name: 'A' }, { id: 'u2', name: 'B' }], wallets: [{ userId: 'u1', balancePaise: 500 }], tags: ['x'] }
  assert.equal(await s.flush(db), 4)
  assert.equal(f.data.users.size, 2); assert.equal(f.data.wallets.get('u1')?.balancePaise, 500); assert.ok(f.data.tags.has('x'))
  assert.equal(await s.flush(db), 0)
})

test('only changed and removed documents are written', async () => {
  const f = fake(), s = new Syncer(f.store, KEYS)
  await s.load()
  const db = { users: [{ id: 'u1', name: 'A' }, { id: 'u2', name: 'B' }], wallets: [], tags: [] as string[] }
  await s.flush(db); f.writes.length = 0
  db.users[0].name = 'A2'; db.users.splice(1, 1)
  assert.equal(await s.flush(db), 2)
  assert.deepEqual(f.writes, ['users:+1-1'])
  assert.equal(f.data.users.get('u1')?.name, 'A2'); assert.ok(!f.data.users.has('u2'))
})

test('load strips _id and restores string lists; loaded data is not rewritten', async () => {
  const f = fake()
  f.data.users.set('u1', { _id: 'u1', id: 'u1', name: 'A' }); f.data.tags.set('x', { _id: 'x' })
  const s = new Syncer(f.store, KEYS)
  const got = await s.load()
  assert.deepEqual(got.users, [{ id: 'u1', name: 'A' }]); assert.deepEqual(got.tags, ['x']); assert.deepEqual(got.wallets, [])
  assert.equal(await s.flush({ ...got }), 0)
})

test('a failed write is retried on the next flush', async () => {
  const f = fake(), s = new Syncer(f.store, KEYS)
  await s.load()
  const orig = f.store.apply; let fail = true
  f.store.apply = async (n, u, d) => { if (fail) throw new Error('down'); return orig(n, u, d) }
  const db = { users: [{ id: 'u1', name: 'A' }], wallets: [], tags: [] as string[] }
  await assert.rejects(s.flush(db), /down/)
  fail = false
  assert.equal(await s.flush(db), 1); assert.ok(f.data.users.has('u1'))
})
