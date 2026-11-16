import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { rupees } from '../astrologers/types'
import type { SessionView } from '../chat/types'
import { clock } from '../chat/useChat'
import { usePrefs } from '../context/PrefsContext'
import { api, isApiError } from '../services/api'
import { openSocket } from '../chat/socket'

interface Notice { id: string; type: string; title: string; body: string; href: string; readAt: string | null; createdAt: string }
interface PushSetup { available: boolean; publicKey: string | null; subscription: PushSubscription | null }

function applicationServerKey(value: string): ArrayBuffer {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64 + '='.repeat((4 - base64.length % 4) % 4))
  const bytes = Uint8Array.from(raw, c => c.charCodeAt(0))
  return bytes.buffer as ArrayBuffer
}

function Shell({ titleKey, children, preview = true }: { titleKey: string; children: ReactNode; preview?: boolean }) {
  const { t } = usePrefs()
  return (
    <section className="wrap sec settings">
      <h1 className="page-h">{t(titleKey)}</h1>
      {preview && <p className="notice">{t('phase.note')}</p>}
      {children}
    </section>
  )
}

export function Notifications() {
  const { t } = usePrefs()
  const [items, setItems] = useState<Notice[] | null>(null)
  const [err, setErr] = useState('')
  const [push, setPush] = useState<PushSetup | null>(null)
  const [pushBusy, setPushBusy] = useState(false)
  const [pushMsg, setPushMsg] = useState('')
  useEffect(() => {
    api<{ items: Notice[] }>('/me/notifications').then(r => setItems(r.items)).catch(e => { setItems([]); setErr(isApiError(e) ? e.message : 'Could not load notifications.') })
    const socket = openSocket()
    socket.on('notification:new', (notice: Notice) => setItems(current => [notice, ...(current ?? []).filter(n => n.id !== notice.id)].slice(0, 100)))
    return () => { socket.disconnect() }
  }, [])
  useEffect(() => {
    let live = true
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setPush({ available: false, publicKey: null, subscription: null })
      return () => { live = false }
    }
    api<{ enabled: boolean; publicKey: string | null }>('/me/push/config').then(async cfg => {
      if (!cfg.enabled || !cfg.publicKey) { if (live) setPush({ available: false, publicKey: null, subscription: null }); return }
      const registration = await navigator.serviceWorker.register('/sw.js')
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        try { await api('/me/push-subscriptions', { method: 'POST', body: subscription.toJSON() }) }
        catch (e) {
          if (isApiError(e) && e.code === 'PUSH_ENDPOINT_TAKEN') {
            if (live) { setPush({ available: true, publicKey: cfg.publicKey, subscription }); setPushMsg('This device is linked to another account. Disable and enable notifications again to move it.') }
            return
          }
          throw e
        }
      }
      if (live) setPush({ available: true, publicKey: cfg.publicKey, subscription })
    }).catch(e => {
      if (live) { setPush({ available: false, publicKey: null, subscription: null }); setPushMsg(isApiError(e) ? e.message : 'Could not prepare browser notifications.') }
    })
    return () => { live = false }
  }, [])

  async function togglePush() {
    if (!push?.available || !push.publicKey) return
    setPushBusy(true); setPushMsg('')
    try {
      if (push.subscription) {
        await api('/me/push-subscriptions', { method: 'DELETE', body: { endpoint: push.subscription.endpoint } })
        await push.subscription.unsubscribe()
        setPush({ ...push, subscription: null }); setPushMsg('Browser notifications disabled on this device.')
      } else {
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') { setPushMsg(t('acct.pushPermission')); return }
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationServerKey(push.publicKey) })
        try { await api('/me/push-subscriptions', { method: 'POST', body: subscription.toJSON() }) }
        catch (e) { await subscription.unsubscribe(); throw e }
        setPush({ ...push, subscription }); setPushMsg(t('acct.pushReady'))
      }
    } catch (e) { setPushMsg(isApiError(e) ? e.message : 'Could not update browser notifications.') }
    finally { setPushBusy(false) }
  }
  async function markRead(id: string) {
    try {
      const updated = await api<Notice>(`/me/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH', body: {} })
      setItems(current => current?.map(n => n.id === updated.id ? updated : n) ?? [])
    } catch (e) { setErr(isApiError(e) ? e.message : 'Could not update notification.') }
  }
  return <Shell titleKey="acct.notifications" preview={false}><div className="panel">
    {err && <p className="alert" role="alert">{err}</p>}
    {push?.available
      ? <div className="row"><button className="btn btn-line" disabled={pushBusy} onClick={() => void togglePush()}>{t(push.subscription ? 'acct.pushDisable' : 'acct.pushEnable')}</button>{pushMsg && <span className="muted small" role="status">{pushMsg}</span>}</div>
      : push && <p className="muted small">{t('acct.pushUnavailable')}</p>}
    {pushMsg && !push?.available && <p className="muted small" role="status">{pushMsg}</p>}
    {items === null ? <p className="muted">{t('common.loading')}</p> : items.length === 0 ? <p className="empty">{t('empty.notifications')}</p> : <div className="notice-list">{items.map(n => <article className="notification-row" key={n.id}>
      <Link to={n.href} onClick={() => { if (!n.readAt) void markRead(n.id) }}><b>{n.title}</b><p>{n.body}</p><small className="muted">{new Date(n.createdAt).toLocaleString()}</small></Link>
      {!n.readAt && <button className="linkish" onClick={() => void markRead(n.id)}>Mark as read</button>}
    </article>)}</div>}
  </div></Shell>
}

function ChatList() {
  const { t } = usePrefs()
  const [items, setItems] = useState<SessionView[] | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => { api<{ items: SessionView[] }>('/sessions/mine').then(r => setItems(r.items)).catch(e => { setItems([]); setErr(isApiError(e) ? e.message : t('oh.loadFail')) }) }, [])
  if (items === null) return <p className="muted">{t('common.loading')}</p>
  if (err) return <p className="alert" role="alert">{err}</p>
  if (items.length === 0) return <p className="empty">{t('oh.empty')} <Link to="/free-astrology-chat">{t('oh.startFree')}</Link></p>
  return (
    <div className="tbl-wrap"><table className="tbl">
      <thead><tr><th>{t('oh.date')}</th><th>{t('oh.astrologer')}</th><th>{t('oh.status')}</th><th>{t('oh.length')}</th><th>{t('oh.paid')}</th><th><span className="sr">{t('oh.actions')}</span></th></tr></thead>
      <tbody>{items.map(s => (
        <tr key={s.id}>
          <td>{new Date(s.requestedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
          <td><Link to={`/best-astrologer/${s.astrologer.slug}`}>{s.astrologer.displayName}</Link></td>
          <td>{t('pr.s.' + s.status)}{s.refundStatus === 'refunded' ? ` · ${t('oh.refunded')}` : s.refundStatus === 'flagged' ? ` · ${t('oh.refundReview')}` : ''}</td>
          <td>{s.status === 'ended' ? clock(s.durationSeconds) : '-'}</td>
          <td>{s.status === 'ended' ? (s.isFree ? t('oh.free') : rupees(s.amountChargedPaise ?? 0)) : '-'}</td>
          <td className="row">
            {(s.status === 'ended' || s.status === 'active' || s.status === 'requested') && <Link to={`/chat/${s.id}`}>{s.status === 'ended' ? t('oh.view') : t('oh.open')}</Link>}
            {s.status === 'ended' && !s.reviewed && !s.astrologer.isDemo && <Link to={`/chat/${s.id}`}>{t('oh.rate')}</Link>}
            <Link to={`/chat-with/${s.astrologer.slug}`}>{t('chat.again')}</Link>
          </td>
        </tr>
      ))}</tbody>
    </table></div>
  )
}

export function OrderHistory() {
  const { t } = usePrefs()
  const tabs = ['chats', 'calls', 'reports', 'recharges'] as const
  const [tab, setTab] = useState<(typeof tabs)[number]>('chats')
  return (
    <Shell titleKey="acct.orders" preview={false}>
      <div className="tabs" role="tablist">
        {tabs.map(k => <button key={k} role="tab" aria-selected={k === tab} className={k === tab ? 'on' : ''} onClick={() => setTab(k)}>{t('orders.' + k)}</button>)}
      </div>
      <div className="panel" role="tabpanel">
        {tab === 'chats' && <ChatList />}
        {tab === 'calls' && <p className="empty">{t('oh.calls')}</p>}
        {tab === 'recharges' && <p className="empty">{t('oh.recharges')} <Link to="/my-wallet">{t('oh.wallet')}</Link>.</p>}
        {tab === 'reports' && <p className="empty">{t('empty.orders')}</p>}
      </div>
    </Shell>
  )
}
