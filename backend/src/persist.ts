// Keeps the in-memory data (see store.ts) in sync with a document database such as MongoDB.
// Pure logic with no imports from the project, so it can be tested with a fake adapter.

/** One document store (MongoDB in production). Every document has a string `_id`. */
export interface DocStore {
  loadAll(names: string[]): Promise<Record<string, Record<string, unknown>[]>>
  apply(name: string, upserts: Record<string, unknown>[], deleteIds: string[]): Promise<void>
}

/** Collection name -> field that is the unique key, or null for a plain list of strings. */
export type KeyMap = Record<string, string | null>

type Snapshot = Map<string, { json: string; doc: Record<string, unknown> }>

export class Syncer {
  private last = new Map<string, Map<string, string>>()
  constructor(private store: DocStore, private keys: KeyMap) {}

  private snapshot(name: string, items: unknown[]): Snapshot {
    const field = this.keys[name]
    const out: Snapshot = new Map()
    for (const item of items) {
      if (field === null) { const k = String(item); out.set(k, { json: k, doc: { _id: k } }); continue }
      const rec = item as Record<string, unknown>
      const k = String(rec[field])
      out.set(k, { json: JSON.stringify(rec), doc: { ...rec, _id: k } })
    }
    return out
  }

  /** Read everything from the database into plain arrays and remember it as already saved. */
  async load(): Promise<Record<string, unknown[]>> {
    const names = Object.keys(this.keys)
    const raw = await this.store.loadAll(names)
    const out: Record<string, unknown[]> = {}
    for (const name of names) {
      const field = this.keys[name]
      const items = (raw[name] ?? []).map(d => (field === null ? String(d._id) : (({ _id, ...rest }) => rest)(d)))
      out[name] = items
      const m = new Map<string, string>()
      for (const [k, v] of this.snapshot(name, items)) m.set(k, v.json)
      this.last.set(name, m)
    }
    return out
  }

  /** Write only what changed since the last successful write. Returns how many documents were written or removed. */
  async flush(data: Record<string, unknown[]>): Promise<number> {
    let n = 0
    // Snapshot first (synchronously) so changes made while we are waiting are picked up by the next flush.
    const snaps = Object.keys(this.keys).map(name => [name, this.snapshot(name, data[name] ?? [])] as const)
    for (const [name, snap] of snaps) {
      const before = this.last.get(name) ?? new Map<string, string>()
      const upserts: Record<string, unknown>[] = [], deletes: string[] = []
      for (const [k, v] of snap) if (before.get(k) !== v.json) upserts.push(v.doc)
      for (const k of before.keys()) if (!snap.has(k)) deletes.push(k)
      if (!upserts.length && !deletes.length) continue
      await this.store.apply(name, upserts, deletes)
      const next = new Map<string, string>()
      for (const [k, v] of snap) next.set(k, v.json)
      this.last.set(name, next)
      n += upserts.length + deletes.length
    }
    return n
  }
}
