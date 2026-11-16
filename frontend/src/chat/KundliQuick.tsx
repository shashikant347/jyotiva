import { useEffect, useState } from 'react'
import NorthChart from '../astro/NorthChart'
import type { KundliResult } from '../astro/types'
import { usePrefs } from '../context/PrefsContext'
import { api } from '../services/api'
import type { BirthSnapshot } from './types'

/** A collapsed chart for the birth details of a chat. It is only calculated when opened. */
export default function KundliQuick({ birth }: { birth: BirthSnapshot }) {
  const { t } = usePrefs()
  const [open, setOpen] = useState(false)
  const [res, setRes] = useState<KundliResult | null>(null)
  const [failed, setFailed] = useState(false)
  const hasPlace = birth.latitude !== null && birth.longitude !== null

  useEffect(() => {
    if (!open || res || !hasPlace) return
    let live = true
    setFailed(false)
    api<KundliResult>('/tools/kundli', {
      method: 'POST', auth: false,
      body: { name: birth.name, birthDate: birth.birthDate, birthTime: birth.birthTime, latitude: birth.latitude, longitude: birth.longitude, timezone: birth.timezone },
    }).then(r => { if (live) setRes(r) }).catch(() => { if (live) setFailed(true) })
    return () => { live = false }
  }, [open, res, hasPlace, birth])

  return (
    <details className="panel kq" onToggle={e => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary>{t('chat.kundli')}</summary>
      {!hasPlace && <p className="muted">{t('chat.kundliNoPlace')}</p>}
      {hasPlace && !res && !failed && <p className="muted">{t('chat.kundliLoad')}</p>}
      {failed && <p className="alert" role="alert">{t('chat.kundliFail')}</p>}
      {res && <>
        {res.warnings.map(w => <p key={w} className="notice">{w}</p>)}
        <div className="summary">
          <div><span className="muted small">{t('chat.lagna')}</span><b>{res.kundli.ascendant.signName}</b></div>
          <div><span className="muted small">{t('chat.moonSign')}</span><b>{res.moon.signName}</b></div>
          <div><span className="muted small">{t('chat.nakshatra')}</span><b>{res.moon.nakshatraName}, {res.moon.pada}</b></div>
        </div>
        <NorthChart k={res.kundli} label={`North Indian birth chart, ${res.kundli.ascendant.signName} ascendant`} />
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>{t('chat.planet')}</th><th>{t('chat.sign')}</th><th>{t('chat.house')}</th></tr></thead>
          <tbody>{res.kundli.planets.map(p => <tr key={p.name}><td>{p.name}{p.retrograde ? ' (R)' : ''}</td><td>{p.signName}</td><td>{p.house}</td></tr>)}</tbody>
        </table></div>
      </>}
    </details>
  )
}
