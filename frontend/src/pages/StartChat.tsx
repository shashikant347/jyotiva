import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { rupees, type Astro } from '../astrologers/types'
import BirthForm from '../components/BirthForm'
import type { ChatStatus } from '../chat/types'
import { useAuth } from '../context/AuthContext'
import { usePrefs } from '../context/PrefsContext'
import { usePageMeta } from '../hooks'
import { api, isApiError } from '../services/api'
import type { BirthProfile } from '../types'
import NotFound from './NotFound'

export default function StartChat() {
  const { slug = '' } = useParams()
  const nav = useNavigate()
  const { user } = useAuth()
  const { t } = usePrefs()
  const [a, setA] = useState<Astro | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'missing' | 'error'>('loading')
  const [status, setStatus] = useState<ChatStatus | null>(null)
  const [profiles, setProfiles] = useState<BirthProfile[] | null>(null)
  const [pid, setPid] = useState('')
  const [useFree, setUseFree] = useState(false)
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  usePageMeta(a ? t('chat.with', { name: a.displayName }) : t('chat.title'), { noindex: true })

  const loadProfiles = useCallback(async (pick?: 'newest') => {
    try {
      const list = await api<BirthProfile[]>('/me/birth-profiles')
      setProfiles(list)
      setPid(prev => {
        if (pick === 'newest' && list.length) return [...list].sort((x, y) => y.createdAt.localeCompare(x.createdAt))[0].id
        if (prev && list.some(p => p.id === prev)) return prev
        return (list.find(p => p.isPrimary) ?? list[0])?.id ?? ''
      })
    } catch { setProfiles([]) }
  }, [])

  useEffect(() => {
    let live = true
    setState('loading')
    api<{ astrologer: Astro }>(`/astrologers/${slug}`, { auth: false })
      .then(r => { if (live) { setA(r.astrologer); setState('ok') } })
      .catch(e => { if (live) setState(isApiError(e) && e.status === 404 ? 'missing' : 'error') })
    api<ChatStatus>('/sessions/status').then(r => { if (live) { setStatus(r); setUseFree(r.freeChatAvailable) } }).catch(() => {})
    void loadProfiles()
    return () => { live = false }
  }, [slug, loadProfiles])

  if (state === 'missing') return <NotFound />
  if (state === 'loading' || !status || profiles === null) return <section className="wrap sec"><p className="muted">{t('common.loading')}</p></section>
  if (state === 'error' || !a) return <section className="wrap sec"><p className="alert" role="alert">{t('sc.loadFail')}</p></section>

  const need = a.chatPricePaise * status.minBalanceMinutes
  const short = !useFree && status.balancePaise < need
  const unavailable = a.status !== 'online'

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy || !pid) return
    setBusy(true); setErr('')
    try {
      const r = await api<{ session: { id: string } }>('/sessions', { method: 'POST', body: { astrologerSlug: slug, birthProfileId: pid, free: useFree } })
      nav(`/chat/${r.session.id}`)
    } catch (x) { setErr(isApiError(x) ? x.message : t('chat.err')); setBusy(false) }
  }

  return (
    <section className="wrap sec settings">
      <h1 className="page-h">{t('chat.with', { name: a.displayName })}</h1>
      {a.isDemo && <p className="notice">{t('sc.demo')}</p>}

      {status.openSessionId && <p className="notice">{t('sc.open')} <Link to={`/chat/${status.openSessionId}`}>{t('sc.goChat')}</Link></p>}
      {unavailable && <p className="alert" role="status">{t(a.status === 'busy' ? 'sc.busy' : 'sc.offline', { name: a.displayName })} <Link to="/chat-with-astrologer">{t('sc.other')}</Link></p>}

      <form className="panel" onSubmit={submit}>
        <h2>{t('sc.whose')}</h2>
        {profiles.length === 0 && !adding && <p className="muted">{t('sc.none')}</p>}
        {profiles.length > 0 && (
          <fieldset className="field">
            <legend className="sr">{t('sc.profile')}</legend>
            {profiles.map(p => (
              <label key={p.id} className="pick">
                <input type="radio" name="bp" value={p.id} checked={pid === p.id} onChange={() => setPid(p.id)} />
                <span><b>{p.name}</b><br /><span className="muted small">{p.birthDate}{p.birthTime ? ` ${p.birthTime}` : ''}, {p.birthPlace}</span></span>
              </label>
            ))}
          </fieldset>
        )}
        {!adding && <div className="row"><button type="button" className="btn btn-line sm" onClick={() => setAdding(true)}>{profiles.length ? t('sc.addMore') : t('sc.addFirst')}</button></div>}
        {adding && <BirthForm defaultName={profiles.length ? '' : user?.name} onSaved={() => { setAdding(false); void loadProfiles('newest') }} onCancel={() => setAdding(false)} />}

        <h2>{t('sc.cost')}</h2>
        {status.freeChatAvailable && (
          <label className="pick"><input type="checkbox" checked={useFree} onChange={e => setUseFree(e.target.checked)} /><span>{t('sc.useFree', { n: status.freeChatMinutes })}</span></label>
        )}
        {useFree
          ? <p className="muted">{t('sc.freeInfo', { n: status.freeChatMinutes })}</p>
          : <>
            <p>{t('sc.paidInfo', { price: rupees(a.chatPricePaise) })}</p>
            <p className="muted small">{t('sc.need', { need: rupees(need), n: status.minBalanceMinutes, bal: rupees(status.balancePaise) })}</p>
            {short && <p className="alert" role="alert">{t('sc.short')} <Link to="/my-wallet">{t('sc.addWallet')}</Link></p>}
          </>}

        {err && <p className="alert" role="alert">{err}</p>}
        <div className="row">
          <button className="btn btn-gold" disabled={busy || !pid || short || unavailable || !!status.openSessionId}>{busy ? t('sc.sending') : useFree ? t('sc.reqFree') : t('sc.req')}</button>
          <Link className="btn btn-line" to={`/best-astrologer/${a.slug}`}>{t('sc.viewProfile')}</Link>
        </div>
        <p className="muted small">{t('sc.foot')}</p>
      </form>
    </section>
  )
}
