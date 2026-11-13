import { Link } from 'react-router-dom'
import { STATIC_DOCS } from '../content/legal'
import { usePageMeta } from '../hooks'

export default function StaticPage({ slug }: { slug: string }) {
  const doc = STATIC_DOCS[slug]
  usePageMeta(doc?.title ?? '', { description: doc?.summary })
  if (!doc) return null
  return (
    <article className="wrap sec doc">
      <h1 className="page-h">{doc.title}</h1>
      <p className="muted small">Last updated: {doc.updated}</p>
      <p className="lead">{doc.summary}</p>
      {doc.sections.map(s => (
        <section key={s.h}>
          <h2>{s.h}</h2>
          {s.p.map((x, i) => <p key={i}>{x}</p>)}
        </section>
      ))}
      <p className="notice">Related: {Object.entries(STATIC_DOCS).filter(([k]) => k !== slug).map(([k, d], i, a) => (
        <span key={k}><Link to={'/' + k} className="linkish">{d.title}</Link>{i < a.length - 1 ? ' · ' : ''}</span>
      ))}</p>
    </article>
  )
}
