import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AstrologerCard from '../astrologers/AstrologerCard'
import type { Astro, Meta } from '../astrologers/types'
import { usePrefs } from '../context/PrefsContext'
import { usePageMeta } from '../hooks'
import { api } from '../services/api'

export default function FreeChat() {
  const { t } = usePrefs()
  usePageMeta('Free astrology chat', { description: 'Your first chat is free for 5 minutes, once per mobile number. Pick an astrologer who is online.' })
  const [items, setItems] = useState<Astro[] | null>(null)
  const [meta, setMeta] = useState<Meta | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    api<{ items: Astro[] }>('/astrologers?mode=chat&online=true&limit=12&sort=popular', { auth: false }).then(r => setItems(r.items)).catch(() => setFailed(true))
    api<Meta>('/astrologers/categories', { auth: false }).then(setMeta).catch(() => {})
  }, [])
  return (
    <section className="wrap sec">
      <h1 className="page-h">{t('fc.title')}</h1>
      <p className="lead">{t('fc.lead')}</p>
      <p className="notice">{t('fc.notice')}</p>
      {failed && <p className="alert" role="alert">{t('fc.fail')}</p>}
      {items === null && !failed && <p className="muted">{t('common.loading')}</p>}
      {items?.length === 0 && <p className="empty">{t('fc.none')} <Link to="/chat-with-astrologer">{t('fc.seeAll')}</Link> {t('fc.later')}</p>}
      <div className="agrid">{items?.map(a => <AstrologerCard key={a.slug} a={a} meta={meta} mode="chat" />)}</div>
    </section>
  )
}
