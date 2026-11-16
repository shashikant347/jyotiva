import { useEffect, useState, type FormEvent } from 'react'
import { hasAdminAccess } from '../adminAccess'
import { useAuth } from '../context/AuthContext'
import { usePageMeta } from '../hooks'
import { api, isApiError } from '../services/api'
import type { AdminRole } from '../types'

interface AdminUser {
  id: string
  name: string
  phone: string
  role: 'user' | 'astrologer' | 'admin'
  adminRole: AdminRole | null
  status: 'active' | 'suspended' | 'deleted'
  createdAt: string
  deletedAt: string | null
  walletBalancePaise: number
  sessionCount: number
}

interface UserPage {
  items: AdminUser[]
  page: number
  limit: number
  total: number
  pages: number
}

const money = (paise: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(paise / 100)

export default function AdminUsers() {
  usePageMeta('Admin: users', { noindex: true })
  const { user } = useAuth()
  const [result, setResult] = useState<UserPage | null>(null)
  const [draftQuery, setDraftQuery] = useState('')
  const [query, setQuery] = useState('')
  const [role, setRole] = useState('')
  const [includeDeleted, setIncludeDeleted] = useState(false)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [roleBusyId, setRoleBusyId] = useState('')
  const [statusBusyId, setStatusBusyId] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    if (!hasAdminAccess(user)) return
    let active = true
    const params = new URLSearchParams({ page: String(page), limit: '25', includeDeleted: String(includeDeleted) })
    if (query) params.set('q', query)
    if (role) params.set('role', role)
    if (statusFilter) params.set('status', statusFilter)
    setLoading(true)
    setError('')
    api<UserPage>(`/admin/users?${params}`).then(data => {
      if (active) setResult(data)
    }).catch(e => {
      if (active) setError(isApiError(e) ? e.message : 'Could not load users.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [includeDeleted, page, query, role, statusFilter, user])

  if (!hasAdminAccess(user)) return <section className="wrap sec"><h1 className="page-h">Not allowed</h1><p className="lead">This page is for super administrators.</p></section>

  function search(e: FormEvent) {
    e.preventDefault()
    setPage(1)
    setQuery(draftQuery.trim())
  }

  function changeRole(value: string) {
    setRole(value)
    setPage(1)
  }

  function changeIncludeDeleted(value: boolean) {
    setIncludeDeleted(value)
    setPage(1)
  }

  function changeStatusFilter(value: string) {
    setStatusFilter(value)
    setPage(1)
  }

  async function changeAdminRole(target: AdminUser, adminRole: AdminRole) {
    setError('')
    setMessage('')
    setRoleBusyId(target.id)
    try {
      await api(`/admin/users/${target.id}/admin-role`, { method: 'POST', body: { adminRole } })
      setResult(current => current && ({ ...current, items: current.items.map(u => u.id === target.id ? { ...u, adminRole } : u) }))
      setMessage(`Updated ${target.name || target.phone} to ${adminRole.replace('_', ' ')}.`)
    } catch (e) {
      setError(isApiError(e) ? e.message : 'Could not change the admin role.')
    } finally {
      setRoleBusyId('')
    }
  }

  function selectAdminRole(target: AdminUser, value: string) {
    if (value === 'super_admin' || value === 'support' || value === 'content' || value === 'finance') {
      void changeAdminRole(target, value)
    }
  }

  async function changeUserStatus(target: AdminUser, status: 'active' | 'suspended') {
    setError('')
    setMessage('')
    if (status === 'suspended' && !window.confirm(`Suspend ${target.name || target.phone}? They will be signed out and cannot start chats.`)) return
    setStatusBusyId(target.id)
    try {
      await api(`/admin/users/${target.id}/status`, { method: 'POST', body: { status } })
      setResult(current => current && ({ ...current, items: current.items.map(u => u.id === target.id ? { ...u, status } : u) }))
      setMessage(`Account ${status}.`)
    } catch (e) {
      setError(isApiError(e) ? e.message : 'Could not change account status.')
    } finally {
      setStatusBusyId('')
    }
  }

  return (
    <section className="wrap sec">
      <h1 className="page-h">Users</h1>
      <p className="lead">Search by name or phone. Deleted accounts are excluded unless you include them.</p>
      <form className="panel admin-user-filters" onSubmit={search}>
        <div className="field">
          <label htmlFor="user-search">Name or phone</label>
          <input id="user-search" value={draftQuery} onChange={e => setDraftQuery(e.target.value)} maxLength={100} />
        </div>
        <div className="field">
          <label htmlFor="user-role">Role</label>
          <select id="user-role" value={role} onChange={e => changeRole(e.target.value)}>
            <option value="">All roles</option>
            <option value="user">User</option>
            <option value="astrologer">Astrologer</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="user-status">Account status</label>
          <select id="user-status" value={statusFilter} onChange={e => changeStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
        <label className="check"><input type="checkbox" checked={includeDeleted} onChange={e => changeIncludeDeleted(e.target.checked)} /> Include deleted accounts</label>
        <button className="btn btn-gold">Search</button>
      </form>
      {error && <p className="alert" role="alert">{error}</p>}
      {message && <p className="notice" role="status">{message}</p>}
      {loading && <p className="muted" aria-live="polite">Loading users…</p>}
      {!loading && result && !error && (
        <div className="panel admin-user-results">
          <p className="muted">Showing {result.items.length ? (result.page - 1) * result.limit + 1 : 0}–{Math.min(result.page * result.limit, result.total)} of {result.total}</p>
          {result.items.length === 0 ? <p className="empty">No users match these filters.</p> : (
            <div className="tbl-wrap"><table className="tbl">
              <thead><tr><th>Name / phone</th><th>Role</th><th>Account</th><th>Joined</th><th>Chats</th><th>Wallet balance</th></tr></thead>
              <tbody>{result.items.map(u => (
                <tr key={u.id}>
                  <td><b>{u.name || 'Unnamed'}</b><br /><span className="muted small">{u.phone}</span>{u.deletedAt && <span className="badge">Deleted</span>}</td>
                  <td>{u.role === 'admin' && !u.deletedAt
                    ? <select aria-label={`Admin role for ${u.name || u.phone}`} value={u.adminRole ?? 'super_admin'} disabled={u.id === user?.id || roleBusyId !== '' || statusBusyId !== ''} onChange={e => selectAdminRole(u, e.target.value)}>
                      <option value="super_admin">Super admin</option>
                      <option value="support">Support</option>
                      <option value="content">Content</option>
                      <option value="finance">Finance</option>
                    </select>
                    : u.role}</td>
                  <td>{u.role !== 'admin' && !u.deletedAt
                    ? <select aria-label={`Account status for ${u.name || u.phone}`} value={u.status} disabled={statusBusyId !== '' || roleBusyId !== ''} onChange={e => { if (e.target.value === 'active' || e.target.value === 'suspended') void changeUserStatus(u, e.target.value) }}>
                      <option value="active">Active</option>
                      <option value="suspended">Suspended</option>
                    </select>
                    : u.status}</td>
                  <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td>{u.sessionCount}</td>
                  <td>{money(u.walletBalancePaise)}</td>
                </tr>
              ))}</tbody>
            </table></div>
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
