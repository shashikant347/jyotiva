import { useState, type FormEvent } from 'react'
import BirthFields, { emptyBirth, toPayload, validateBirth, type BirthState } from '../astro/BirthFields'
import type { MatchResult } from '../astro/types'
import { usePageMeta } from '../hooks'
import { api, isApiError } from '../services/api'

export default function KundliMatching() {
  usePageMeta('Kundli Matching (Guna Milan)', { description: 'Match two Kundlis with Ashtakoota Guna Milan: Varna, Tara, Graha Maitri, Gana, Bhakoot and Nadi.' })
  const [bride, setBride] = useState<BirthState>(emptyBirth())
  const [groom, setGroom] = useState<BirthState>(emptyBirth())
  const [eb, setEb] = useState<Record<string, string>>({})
  const [eg, setEg] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [res, setRes] = useState<MatchResult | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const vb = validateBirth(bride), vg = validateBirth(groom)
    setEb(vb); setEg(vg); setMsg('')
    if (Object.keys(vb).length || Object.keys(vg).length) return
    setBusy(true)
    try {
      setRes(await api<MatchResult>('/tools/matching', { method: 'POST', body: { bride: toPayload(bride), groom: toPayload(groom) }, auth: false }))
    } catch (err) {
      setRes(null)
      setMsg(isApiError(err) ? (err.code === 'NETWORK' ? "Can't reach the server. Check your connection." : err.message) : 'Something went wrong')
    } finally { setBusy(false) }
  }

  return (
    <section className="wrap sec">
      <h1 className="page-h">Kundli Matching</h1>
      <p className="lead">Compare two birth charts with the Ashtakoota (Guna Milan) method, based on the Moon sign and nakshatra of each person.</p>
      <form className="match-forms" onSubmit={submit} noValidate>
        <div className="panel"><BirthFields title="Bride's details" value={bride} onChange={setBride} errors={eb} /></div>
        <div className="panel"><BirthFields title="Groom's details" value={groom} onChange={setGroom} errors={eg} /></div>
        {msg && <p className="alert" role="alert">{msg}</p>}
        <div><button className="btn btn-gold" disabled={busy}>{busy ? 'Matching…' : 'Match Kundli'}</button></div>
      </form>

      {res && (
        <div className="panel result-match" aria-live="polite">
          <h2>{res.total} out of {res.maxScored} points <span className="muted">· {res.verdict}</span></h2>
          {res.pending.length > 0 && (
            <p className="notice">{res.pending.join(' and ')} {res.pending.length > 1 ? 'are' : 'is'} not scored yet, so this total is out of {res.maxScored} instead of 36. These tables are being verified, and the scores will be added once they are.</p>
          )}
          {res.warnings.map(w => <p key={w} className="notice">{w}</p>)}
          <p className="muted">Bride: {res.bride.moonSign}, {res.bride.nakshatra} ({res.bride.pada}) · Groom: {res.groom.moonSign}, {res.groom.nakshatra} ({res.groom.pada})</p>
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>Koota</th><th>Bride</th><th>Groom</th><th>Score</th></tr></thead>
            <tbody>
              {res.kootas.map(k => (
                <tr key={k.name}>
                  <td><b>{k.name}</b><br /><span className="muted small">{k.note}</span></td>
                  <td>{k.bride || '–'}</td><td>{k.groom || '–'}</td>
                  <td>{k.score === null ? 'Not scored' : `${k.score} / ${k.max}`}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
          <p className="muted small">Mangal dosha: bride {res.bride.mangal ? 'present' : 'not present'}, groom {res.groom.mangal ? 'present' : 'not present'}. A match score is one input among many; the usual guideline is at least half the points. For guidance only. Please speak to an astrologer before any decision.</p>
        </div>
      )}
    </section>
  )
}
