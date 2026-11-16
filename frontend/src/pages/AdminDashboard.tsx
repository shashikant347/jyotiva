import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { hasAdminAccess } from '../adminAccess'
import { useAuth } from '../context/AuthContext'
import { usePageMeta } from '../hooks'
import { api, isApiError } from '../services/api'

interface Dashboard {
  metrics: {
    users: { total: number; newToday: number }
    astrologers: { approved: number; pending: number; online: number; demo: number }
    sessions: { total: number; active: number; endedToday: number; platformFeesPaise: number }
    payouts: { requested: number; approved: number }
    payments: { paidTodayCount: number; paidTodayPaise: number; totalPaidPaise: number }
    openSupportTickets: number
    publishedHoroscopes: number
    publishedBlogPosts: number
  }
  recentSessions: Array<{ id: string; status: string; requestedAt: number; durationSeconds: number; amountChargedPaise: number; isFree: boolean }>
}

const money = (paise: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(paise / 100)

export default function AdminDashboard() {
  usePageMeta('Admin dashboard', { noindex: true })
  const { user } = useAuth()
  const [data, setData] = useState<Dashboard | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!hasAdminAccess(user)) return
    api<Dashboard>('/admin/dashboard').then(setData).catch(e => setError(isApiError(e) ? e.message : 'Could not load the dashboard.'))
  }, [user])

  if (!hasAdminAccess(user)) return <section className="wrap sec"><h1 className="page-h">Not allowed</h1><p className="lead">This page is for super administrators.</p></section>
  if (error) return <section className="wrap sec"><h1 className="page-h">Admin dashboard</h1><p className="alert" role="alert">{error}</p></section>
  if (!data) return <section className="wrap sec" aria-live="polite"><h1 className="page-h">Admin dashboard</h1><p className="muted">Loading dashboard…</p></section>

  const { metrics: m } = data
  const cards = [
    { title: 'Users', value: m.users.total, note: `+${m.users.newToday} today` },
    { title: 'Approved astrologers', value: m.astrologers.approved, note: `${m.astrologers.online} online · ${m.astrologers.pending} pending` },
    { title: 'Active chats', value: m.sessions.active, note: `${m.sessions.endedToday} ended today · ${m.sessions.total} total` },
    { title: 'Payout requests', value: m.payouts.requested, note: `${m.payouts.approved} approved, awaiting manual settlement` },
    { title: 'Paid top-ups today', value: money(m.payments.paidTodayPaise), note: `${m.payments.paidTodayCount} payment${m.payments.paidTodayCount === 1 ? '' : 's'}` },
    { title: 'All-time paid top-ups', value: money(m.payments.totalPaidPaise), note: 'Captured payments only' },
    { title: 'Chat platform fees', value: money(m.sessions.platformFeesPaise), note: 'Ended sessions, before refunds' },
    { title: 'Open support tickets', value: m.openSupportTickets, note: 'Waiting for an admin reply' },
    { title: 'Published content', value: m.publishedHoroscopes + m.publishedBlogPosts, note: `${m.publishedHoroscopes} horoscopes · ${m.publishedBlogPosts} articles` },
  ]

  return (
    <section className="wrap sec">
      <h1 className="page-h">Admin dashboard</h1>
      <p className="lead">Current platform overview. Demo astrologers are listed separately and excluded from real marketplace totals ({m.astrologers.demo} demo profiles).</p>
      <div className="dashboard-grid">
        {cards.map(card => <article className="panel dashboard-card" key={card.title}><span className="muted">{card.title}</span><b>{card.value}</b><small className="muted">{card.note}</small></article>)}
      </div>
      <div className="panel dashboard-section">
        <div className="sec-h"><h2>Admin tools</h2></div>
        <div className="row">
          <Link className="btn btn-line" to="/admin/users">Users ({m.users.total})</Link>
          <Link className="btn btn-line" to="/admin/astrologers">Astrologers ({m.astrologers.pending} pending)</Link>
          <Link className="btn btn-line" to="/admin/horoscope">Horoscopes</Link>
          <Link className="btn btn-line" to="/admin/festivals">Festivals</Link>
          <Link className="btn btn-line" to="/admin/blog">Blog</Link>
          <Link className="btn btn-line" to="/admin/support">Support ({m.openSupportTickets} open)</Link>
          <Link className="btn btn-line" to="/admin/chat-reports">Chat reports</Link>
          <Link className="btn btn-line" to="/admin/reports">Reports</Link>
          <Link className="btn btn-line" to="/admin/payouts">Payouts</Link>
          <Link className="btn btn-line" to="/admin/audit-logs">Audit logs</Link>
        </div>
      </div>
      <div className="panel dashboard-section">
        <h2>Recent sessions</h2>
        {data.recentSessions.length === 0 ? <p className="empty">No sessions yet.</p> : (
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>Session</th><th>Status</th><th>Requested</th><th>Duration</th><th>Charged</th></tr></thead>
            <tbody>{data.recentSessions.map(s => <tr key={s.id}>
              <td>{s.id.slice(0, 8)}</td>
              <td>{s.status}{s.isFree ? ' · Free' : ''}</td>
              <td>{new Date(s.requestedAt).toLocaleString()}</td>
              <td>{Math.floor(s.durationSeconds / 60)}m {s.durationSeconds % 60}s</td>
              <td>{money(s.amountChargedPaise)}</td>
            </tr>)}</tbody>
          </table></div>
        )}
      </div>
    </section>
  )
}
