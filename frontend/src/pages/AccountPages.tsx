import { useState, type ReactNode } from 'react'
import { usePrefs } from '../context/PrefsContext'
import { FAQ } from '../data'

function Shell({ titleKey, children }: { titleKey: string; children: ReactNode }) {
  const { t } = usePrefs()
  return (
    <section className="wrap sec settings">
      <h1 className="page-h">{t(titleKey)}</h1>
      <p className="notice">{t('phase.note')}</p>
      {children}
    </section>
  )
}

export function Notifications() {
  const { t } = usePrefs()
  return <Shell titleKey="acct.notifications"><div className="panel"><p className="empty">{t('empty.notifications')}</p></div></Shell>
}

export function Wallet() {
  const { t } = usePrefs()
  return (
    <Shell titleKey="acct.wallet">
      <div className="panel">
        <small className="muted">{t('wallet.balance')}</small>
        <p className="balance">₹0.00</p>
        <div className="row">{[100, 200, 500, 1000].map(n => <button key={n} className="btn btn-line sm" disabled>₹{n}</button>)}</div>
        <p className="muted small">{t('wallet.soon')}</p>
      </div>
      <div className="panel"><h2>{t('wallet.history')}</h2><p className="empty">{t('empty.transactions')}</p></div>
    </Shell>
  )
}

export function OrderHistory() {
  const { t } = usePrefs()
  const tabs = ['chats', 'calls', 'reports', 'recharges'] as const
  const [tab, setTab] = useState<(typeof tabs)[number]>('chats')
  return (
    <Shell titleKey="acct.orders">
      <div className="tabs" role="tablist">
        {tabs.map(k => <button key={k} role="tab" aria-selected={k === tab} className={k === tab ? 'on' : ''} onClick={() => setTab(k)}>{t('orders.' + k)}</button>)}
      </div>
      <div className="panel" role="tabpanel"><p className="empty">{t('empty.orders')}</p></div>
    </Shell>
  )
}

export function CustomerSupport() {
  const { t } = usePrefs()
  return (
    <Shell titleKey="acct.support">
      <div className="panel">
        <p className="muted">{t('support.soon')}</p>
        <h2>{t('support.faq')}</h2>
        {FAQ.map(([q, a]) => <details className="faq" key={q}><summary>{q}</summary><p>{a}</p></details>)}
      </div>
    </Shell>
  )
}
