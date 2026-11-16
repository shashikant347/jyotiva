import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { usePageMeta } from '../hooks'
import { usePrefs } from '../context/PrefsContext'
import { api, isApiError } from '../services/api'
import NotFound from './NotFound'

const SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces']
const GLYPH = ['\u2648', '\u2649', '\u264A', '\u264B', '\u264C', '\u264D', '\u264E', '\u264F', '\u2650', '\u2651', '\u2652', '\u2653']

interface Page { period: 'daily' | 'weekly' | 'monthly' | 'yearly'; category: string; shift?: number; title: string; date?: string }
export const HOROSCOPE_PAGES: Record<string, Page> = {
  'daily-horoscope': { period: 'daily', category: 'general', title: 'Daily Horoscope' },
  'tomorrow-horoscope': { period: 'daily', category: 'general', shift: 1, title: "Tomorrow's Horoscope" },
  'yesterday-horoscope': { period: 'daily', category: 'general', shift: -1, title: "Yesterday's Horoscope" },
  'weekly-horoscope': { period: 'weekly', category: 'general', title: 'Weekly Horoscope' },
  'monthly-horoscope': { period: 'monthly', category: 'general', title: 'Monthly Horoscope' },
  'yearly-horoscope': { period: 'yearly', category: 'general', title: 'Yearly Horoscope' },
  'yearly-horoscope-2027': { period: 'yearly', category: 'general', title: 'Yearly Horoscope 2027', date: '2027-06-01' },
  'daily-love-horoscope': { period: 'daily', category: 'love', title: 'Daily Love Horoscope' },
  'daily-career-horoscope': { period: 'daily', category: 'career', title: 'Daily Career Horoscope' },
  'daily-finance-horoscope': { period: 'daily', category: 'finance', title: 'Daily Finance Horoscope' },
  'daily-health-horoscope': { period: 'daily', category: 'health', title: 'Daily Health Horoscope' },
}

interface Item {
  signName: string; dateFrom: string; dateTo: string; text: string; luckyNumber: number | null; luckyColor: string | null; mood: string | null
  scores: { love: number | null; career: number | null; health: number | null; money: number | null }; languageFallback: boolean; isSample?: boolean
}

const HI_TITLE: Record<string, string> = {
  'daily-horoscope': 'आज का राशिफल', 'tomorrow-horoscope': 'कल का राशिफल', 'yesterday-horoscope': 'बीते कल का राशिफल',
  'weekly-horoscope': 'साप्ताहिक राशिफल', 'monthly-horoscope': 'मासिक राशिफल', 'yearly-horoscope': 'वार्षिक राशिफल', 'yearly-horoscope-2027': '2027 का वार्षिक राशिफल',
  'daily-love-horoscope': 'आज का प्रेम राशिफल', 'daily-career-horoscope': 'आज का करियर राशिफल', 'daily-finance-horoscope': 'आज का वित्त राशिफल', 'daily-health-horoscope': 'आज का स्वास्थ्य राशिफल',
}

const istDate = (shift = 0): string => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(Date.now() + shift * 86400_000))

function Bar({ label, v }: { label: string; v: number | null }) {
  if (v === null) return null
  return (
    <div className="bar-row"><span>{label}</span>
      <div className="bar" role="img" aria-label={`${label}: ${v} out of 5`}>{[1, 2, 3, 4, 5].map(i => <i key={i} className={i <= v ? 'on' : ''} />)}</div>
    </div>
  )
}

export default function Horoscope() {
  const { slug = '', sign } = useParams()
  const nav = useNavigate()
  const { lang, t } = usePrefs()
  const page = HOROSCOPE_PAGES[slug]
  const signIdx = sign ? SIGNS.findIndex(s => s.toLowerCase() === sign.toLowerCase()) : -1
  const [item, setItem] = useState<Item | null>(null)
  const [state, setState] = useState<'idle' | 'loading' | 'none' | 'error'>('idle')
  const date = page ? page.date ?? istDate(page.shift ?? 0) : ''
  const pageTitle = page ? (lang === 'hi' ? HI_TITLE[slug] ?? page.title : page.title) : ''
  const dateLabel = date ? new Date(`${date}T12:00:00+05:30`).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : ''
  const periodLinks = [['daily-horoscope', 'Today'], ['tomorrow-horoscope', 'Tomorrow'], ['weekly-horoscope', 'Weekly'], ['monthly-horoscope', 'Monthly'], ['yearly-horoscope', 'Yearly']] as const
  usePageMeta(page ? `${signIdx >= 0 ? SIGNS[signIdx] + ' ' : ''}${pageTitle}` : '', { description: page ? `${signIdx >= 0 ? SIGNS[signIdx] + ' ' : ''}${pageTitle} · ${date}. ${pageTitle} by zodiac sign.` : undefined })

  useEffect(() => {
    if (!page || signIdx < 0) { setItem(null); setState('idle'); return }
    let live = true
    setState('loading'); setItem(null)
    api<Item>(`/horoscope/${page.period}/${SIGNS[signIdx].toLowerCase()}?date=${date}&category=${page.category}&lang=${lang}`, { auth: false })
      .then(r => { if (live) { setItem(r); setState('idle') } })
      .catch(e => { if (live) setState(isApiError(e) && e.status === 404 ? 'none' : 'error') })
    return () => { live = false }
  }, [page, signIdx, date, lang])

  if (!page || (sign && signIdx < 0)) return <NotFound />
  return (
    <section className="wrap sec horoscope-page">
      <div className="horoscope-heading">
        <div className="horoscope-heading-copy">
          <p className="horoscope-kicker"><span aria-hidden="true">&#x2726;</span> Your zodiac, your moment</p>
          <h1 className="page-h">{signIdx >= 0 ? `${SIGNS[signIdx]} ${pageTitle}` : pageTitle}</h1>
          <p className="lead">{page.period === 'daily' ? `${t('horo.for')} ${dateLabel}.` : t('horo.chooseSign')}</p>
        </div>
        <div className="horoscope-date-card"><span>READING FOR</span><b>{dateLabel}</b><small>India Standard Time</small></div>
      </div>

      <nav className="horoscope-period-nav" aria-label="Horoscope period">
        {periodLinks.map(([key, label]) => <Link key={key} className={slug === key ? 'selected' : ''} aria-current={slug === key ? 'page' : undefined} to={`/horoscope/${key}${sign ? '/' + sign : ''}`}>{label}</Link>)}
      </nav>

      <section className="panel horoscope-picker">
        <div className="horoscope-picker-heading"><div><span className="horoscope-kicker">12 SIGNS &#xB7; ONE SKY</span><h2>Choose your zodiac sign</h2><p className="muted">Select a sign to open its {page.period === 'daily' ? 'daily' : page.period} reading.</p></div>{signIdx >= 0 && <span className="selected-sign-glyph" aria-hidden="true">{GLYPH[signIdx]}</span>}</div>
        <div className="signs" role="list">
          {SIGNS.map((s, i) => (
            <Link key={s} role="listitem" to={`/horoscope/${slug}/${s.toLowerCase()}`} className={'sign' + (i === signIdx ? ' on' : '')} aria-current={i === signIdx ? 'page' : undefined}>
              <span aria-hidden="true">{GLYPH[i]}</span>{s}
            </Link>
          ))}
        </div>
        {signIdx < 0 && <p className="horoscope-pick-hint">Choose a sign to see the complete reading.</p>}
      </section>

      <div className="horoscope-content">
        {state === 'loading' && <p className="muted">{t('common.loading')}</p>}
        {state === 'none' && <div className="panel"><p>{t('horo.none', { sign: SIGNS[signIdx], title: pageTitle })}</p></div>}
        {state === 'error' && <p className="alert" role="alert">{t('horo.failed')}</p>}
        {item && (
          <article className="panel horo">
            <div className="horo-result-heading"><div><span className="horoscope-kicker">YOUR READING</span><h2>{item.signName}</h2><p className="muted small">{item.dateFrom === item.dateTo ? item.dateFrom : `${item.dateFrom} to ${item.dateTo}`}</p></div><span className="horo-result-glyph" aria-hidden="true">{signIdx >= 0 ? GLYPH[signIdx] : '\u2726'}</span></div>
            {item.isSample && <p className="notice">DEMO PREVIEW ONLY &mdash; this fictional sample is for layout review, not an actual horoscope.</p>}
            {item.languageFallback && lang === 'hi' && <p className="notice">{t('horo.fallback')}</p>}
            <p className="horo-text">{item.text}</p>
            <div className="horo-meta">
              {item.luckyNumber !== null && <div><span className="muted small">Lucky number</span><b>{item.luckyNumber}</b></div>}
              {item.luckyColor && <div><span className="muted small">Lucky colour</span><b>{item.luckyColor}</b></div>}
              {item.mood && <div><span className="muted small">Mood</span><b>{item.mood}</b></div>}
            </div>
            <div className="bars"><Bar label={t('horo.love')} v={item.scores.love} /><Bar label={t('horo.career')} v={item.scores.career} /><Bar label={t('horo.health')} v={item.scores.health} /><Bar label={t('horo.money')} v={item.scores.money} /></div>
            <p className="muted small">{t('horo.disclaimer')}</p>
          </article>
        )}
      </div>

      <nav className="panel horo-more" aria-label={t('horo.more')}><b>{t('horo.more')}:</b>
        {Object.entries(HOROSCOPE_PAGES).filter(([key]) => key !== slug).map(([key, pageInfo]) => (
          <Link key={key} className="horo-more-link" to={`/horoscope/${key}${sign ? '/' + sign : ''}`}>{pageInfo.title}</Link>
        ))}
      </nav>
    </section>
  )
}
