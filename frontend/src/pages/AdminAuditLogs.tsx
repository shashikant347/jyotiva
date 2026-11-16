import { useEffect, useState, type FormEvent } from 'react'
import { hasAdminAccess } from '../adminAccess'
import { useAuth } from '../context/AuthContext'
import { usePageMeta } from '../hooks'
import { api, isApiError } from '../services/api'

interface AuditRow {
  id: string
  actorId: string
  actorName: string
  action: string
  entity: string
  entityId: string
  meta: unknown
  createdAt: string
}

interface AuditPage {
  items: AuditRow[]
  page: number
  limit: number
  total: number
  pages: number
}

export default function AdminAuditLogs() {
  usePageMeta('Admin: audit logs', { noindex: true })
  const { user } = useAuth()
  const [result, setResult] = useState<AuditPage | null>(null)
  const [draftQuery, setDraftQuery] = useState('')
  const [query, setQuery] = useState('')
  const [entity, setEntity] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!hasAdminAccess(user)) return
    let active = true
    const params = new URLSearchParams({ page: String(page), limit: '25' })
    if (query) params.set('q', query)
    if (entity) params.set('entity', entity)
    setLoading(true)
    setError('')
    api<AuditPage>(`/admin/audit-logs?${params}`).then(data => {
      if (active) setResult(data)
    }).catch(e => {
      if (active) setError(isApiError(e) ? e.message : 'Could not load audit logs.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [entity, page, query, user])

  if (!hasAdminAccess(user)) return <section className="wrap sec"><h1 className="page-h">Not allowed</h1><p className="lead">This page is for super administrators.</p></section>

  function search(e: FormEvent) {
    e.preventDefault()
    setPage(1)
    setQuery(draftQuery.trim())
  }

  function filterEntity(value: string) {
    setEntity(value)
    setPage(1)
  }

  return (
    <section className="wrap sec">
      <h1 className="page-h">Audit logs</h1>
      <p className="lead">Review recorded admin actions. Entries are read-only.</p>
      <form className="panel admin-user-filters" onSubmit={search}>
        <div className="field">
          <label htmlFor="audit-search">Action, actor or record ID</label>
          <input id="audit-search" value={draftQuery} onChange={e => setDraftQuery(e.target.value)} maxLength={100} />
        </div>
        <div className="field">
          <label htmlFor="audit-entity">Record type</label>
          <select id="audit-entity" value={entity} onChange={e => filterEntity(e.target.value)}>
            <option value="">All types</option>
            <option value="blog">Blog</option>
            <option value="coupon">Coupon</option>
            <option value="session">Session</option>
            <option value="ticket">Support ticket</option>
            <option value="user">User</option>
          </select>
        </div>
        <button className="btn btn-gold">Search</button>
      </form>
      {error && <p className="alert" role="alert">{error}</p>}
      {loading && <p className="muted" aria-live="polite">Loading audit logs…</p>}
      {!loading && result && !error && (
        <div className="panel admin-user-results">
          <p className="muted">Showing {result.items.length ? (result.page - 1) * result.limit + 1 : 0}–{Math.min(result.page * result.limit, result.total)} of {result.total}</p>
          {result.items.length === 0 ? <p className="empty">No audit entries match these filters.</p> : (
            <div className="audit-list">
              {result.items.map(log => (
                <article className="audit-entry" key={log.id}>
                  <div className="audit-head">
                    <b>{log.action}</b>
                    <time className="muted small" dateTime={log.createdAt}>{new Date(log.createdAt).toLocaleString()}</time>
                  </div>
                  <p className="muted small">By {log.actorName} · {log.entity} · record {log.entityId}</p>
                  {log.meta !== null && log.meta !== undefined && <pre>{JSON.stringify(log.meta, null, 2)}</pre>}
                </article>
              ))}
            </div>
          )}
          <div className="row admin-user-pager">
            <button type="button" className="btn btn-line" disabled={page <= 1 || loading} onClick={() => setPage(current => current - 1)}>Previous</button>
            <span className="muted">Page {result.page} of {result.pages}</span>
            <button type="button" className="btn btn-line" disabled={page >= result.pages || loading} onClick={() => setPage(current => current + 1)}>Next</button>
          </div>
        </div>
      )}
    </section>
  )
}
