import { Fragment, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePrefs } from '../context/PrefsContext'
import { errorText } from '../utils'

export default function Login() {
  const { user, sendOtp, verifyOtp } = useAuth()
  const { t, lang, theme } = usePrefs()
  const nav = useNavigate()
  const loc = useLocation()
  const asked = (loc.state as { from?: string } | null)?.from
  const from = asked && asked.startsWith('/') && !asked.startsWith('//') ? asked : null

  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [phone, setPhone] = useState('')
  const [agree, setAgree] = useState(false)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [devOtp, setDevOtp] = useState<string | undefined>()
  const [cool, setCool] = useState(0)
  const finishing = useRef(false)

  useEffect(() => {
    if (cool <= 0) return
    const id = setTimeout(() => setCool(c => c - 1), 1000)
    return () => clearTimeout(id)
  }, [cool])

  // Already signed in (and not in the middle of our own login): nothing to do here.
  if (user && !finishing.current) return <Navigate to={from ?? '/'} replace />

  async function send(e?: FormEvent) {
    e?.preventDefault()
    setErr('')
    if (!agree) { setErr(t('auth.consentRequired')); return }
    setBusy(true)
    try {
      const r = await sendOtp(phone)
      setDevOtp(r.devOtp)
      setCool(r.resendAfterSec)
      setCode('')
      setStep('code')
    } catch (x) { setErr(errorText(x, t)) } finally { setBusy(false) }
  }

  async function verify(e: FormEvent) {
    e.preventDefault()
    setErr('')
    setBusy(true)
    finishing.current = true
    try {
      const { isNewUser } = await verifyOtp(phone, code, { language: lang, theme })
      nav(from ?? (isNewUser ? '/profile-settings' : '/'), { replace: true })
    } catch (x) {
      finishing.current = false
      setErr(errorText(x, t))
      setBusy(false)
    }
  }

  const shown = '+91 ' + phone.replace(/\D/g, '').replace(/^(?:91)?(\d{10}).*$/, '$1')
  const consent = t('auth.consent').split(/(\{terms\}|\{privacy\})/)

  return (
    <section className="wrap sec">
      <div className="auth-card panel">
        <h1 className="auth-h">{t('auth.title')}</h1>
        {step === 'phone' ? (
          <form className="form" onSubmit={send} noValidate>
            <p className="muted">{t('auth.sub')}</p>
            <div className="field">
              <label htmlFor="phone">{t('auth.phone')}</label>
              <div className="phone-row"><span className="cc">+91</span>
                <input id="phone" type="tel" inputMode="numeric" autoComplete="tel-national" value={phone} onChange={e => setPhone(e.target.value)} maxLength={16} placeholder="98765 43210" autoFocus required />
              </div>
            </div>
            <label className="check">
              <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} />
              <span>{consent.map((part, i) => (
                <Fragment key={i}>
                  {part === '{terms}' ? <Link to="/terms-and-conditions" target="_blank">{t('auth.terms')}</Link>
                    : part === '{privacy}' ? <Link to="/privacy-policies" target="_blank">{t('auth.privacy')}</Link> : part}
                </Fragment>
              ))}</span>
            </label>
            {err && <p className="alert" role="alert">{err}</p>}
            <button className="btn btn-gold" type="submit" disabled={busy || phone.trim().length < 10}>{busy ? t('auth.sending') : t('auth.sendCode')}</button>
          </form>
        ) : (
          <form className="form" onSubmit={verify} noValidate>
            <p className="muted">{t('auth.enterCode', { phone: shown })}</p>
            <div className="field">
              <label htmlFor="code">{t('auth.code')}</label>
              <input id="code" className="otp" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} autoFocus required />
            </div>
            {devOtp && <p className="notice">{t('auth.devOtp', { code: devOtp })}</p>}
            {err && <p className="alert" role="alert">{err}</p>}
            <button className="btn btn-gold" type="submit" disabled={busy || code.length !== 6}>{busy ? t('auth.verifying') : t('auth.verify')}</button>
            <div className="row">
              <button type="button" className="linkish" disabled={cool > 0 || busy} onClick={() => send()}>{cool > 0 ? t('auth.resendIn', { s: cool }) : t('auth.resend')}</button>
              <button type="button" className="linkish" onClick={() => { setStep('phone'); setErr(''); setDevOtp(undefined) }}>{t('auth.change')}</button>
            </div>
          </form>
        )}
      </div>
    </section>
  )
}
