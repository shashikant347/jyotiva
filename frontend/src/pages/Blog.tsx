import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { usePageMeta } from '../hooks'
import { api, isApiError } from '../services/api'

export interface Post { slug: string; coverImageUrl?: string | null; title: string; excerpt: string; category: string; tags: string[]; authorName: string; seoTitle: string; seoDescription: string; isSample: boolean; publishedAt: string | null; body?: string }
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '')
const categoryMark = (category: string) => ({ basics: String.fromCodePoint(0x25c8), horoscope: String.fromCodePoint(0x263C), panchang: String.fromCodePoint(0x25F7) }[category.toLowerCase()] ?? String.fromCodePoint(0x2726))
const categoryClass = (category: string) => category.toLowerCase().replace(/[^a-z0-9]+/g, '-')

/** Render a small, safe Markdown subset as React elements; submitted HTML stays text. */
function inline(text: string, keyPrefix: string) {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={`${keyPrefix}-${i}`}>{part.slice(2, -2)}</strong>
    if (part.startsWith('*') && part.endsWith('*')) return <em key={`${keyPrefix}-${i}`}>{part.slice(1, -1)}</em>
    return part
  })
}

export function Article({ body }: { body: string }) {
  const blocks = body.split(/\n{2,}/).filter(block => block.trim())
  return <div className="article">{blocks.map((block, i) => {
    const lines = block.split('\n')
    if (block.startsWith('## ')) return <h2 key={i}>{inline(block.slice(3), `h-${i}`)}</h2>
    if (lines.every(line => line.startsWith('- '))) return <ul key={i}>{lines.map((line, j) => <li key={j}>{inline(line.slice(2), `l-${i}-${j}`)}</li>)}</ul>
    if (lines.every(line => line.startsWith('> '))) return <blockquote key={i}>{lines.map((line, j) => <p key={j}>{inline(line.slice(2), `q-${i}-${j}`)}</p>)}</blockquote>
    return <p key={i}>{lines.map((line, j) => <span key={j}>{j > 0 && <br />}{inline(line, `p-${i}-${j}`)}</span>)}</p>
  })}</div>
}

export function BlogList() {
  usePageMeta('Astrology blog', { description: 'Guides to Kundli, horoscopes, Panchang and more.' })
  const [sp, setSp] = useSearchParams()
  const [data, setData] = useState<{ total: number; categories: string[]; items: Post[] } | null>(null)
  const [err, setErr] = useState('')
  const category = sp.get('category') ?? '', page = Number(sp.get('page') || 1), PER = 9
  useEffect(() => {
    const qs = new URLSearchParams({ page: String(page), limit: String(PER) }); if (category) qs.set('category', category)
    api<typeof data>('/blog?' + qs.toString(), { auth: false }).then(setData).catch(e => setErr(isApiError(e) ? e.message : 'Something went wrong'))
  }, [category, page])
  const go = (k: string, v: string) => { const n = new URLSearchParams(sp); if (v) n.set(k, v); else n.delete(k); if (k !== 'page') n.delete('page'); setSp(n) }
  return (
    <section className="wrap sec">
      <h1 className="page-h">Astrology blog</h1>
      <p className="lead">Simple guides to Kundli, horoscopes, Panchang and more.</p>
      {err && <p className="alert" role="alert">{err}</p>}
      {data && (
        <>
          <div className="chip-row">
            <button className={'cchip' + (!category ? ' on' : '')} onClick={() => go('category', '')}>All</button>
            {data.categories.map(c => <button key={c} className={'cchip' + (category === c ? ' on' : '')} onClick={() => go('category', c)}>{c}</button>)}
          </div>
          {data.total === 0 && <p className="panel">No articles yet.</p>}
          <div className="bgrid">
            {data.items.map(p => (
                            <article className="bcard" key={p.slug}>
                <Link to={'/astrology-blog/' + p.slug} className={'bcard-art '+(p.coverImageUrl?'has-cover':'topic-'+categoryClass(p.category))} aria-label={'Read '+p.title}>
                  {p.coverImageUrl
                    ? <img className="blog-cover" src={p.coverImageUrl} alt="" loading="lazy" />
                    : <span className="bcard-art-copy"><span className="bcard-art-mark" aria-hidden="true">{categoryMark(p.category)}</span><span className="bcard-art-brand">Jyotiva <i /> {p.category}</span></span>}
                </Link>
                <div className="bcard-content">
                  <div className="bcard-meta"><span className="bcard-category">{p.category}</span>{p.publishedAt&&<time className="muted small" dateTime={p.publishedAt}>{day(p.publishedAt)}</time>}</div>
                  <h2><Link to={'/astrology-blog/'+p.slug}>{p.title}</Link></h2>
                  <p className="bcard-excerpt">{p.excerpt}</p>
                  <div className="bcard-footer"><span className="muted small">{p.isSample?'Sample guide':p.authorName}</span><Link to={'/astrology-blog/'+p.slug} className="more">Read article <span aria-hidden="true">&#x2192;</span></Link></div>
                </div>
              </article>
            ))}
          </div>
          {data.total > PER && (
            <div className="row pager-row">
              <button className="btn btn-line" disabled={page <= 1} onClick={() => go('page', String(page - 1))}>Previous</button>
              <span className="muted">Page {page} of {Math.ceil(data.total / PER)}</span>
              <button className="btn btn-line" disabled={page * PER >= data.total} onClick={() => go('page', String(page + 1))}>Next</button>
            </div>
          )}
        </>
      )}
    </section>
  )
}

export function BlogPost() {
  const { slug } = useParams()
  const [data, setData] = useState<{ post: Post; related: Post[] } | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => { setData(null); setErr(''); api<typeof data>(`/blog/${slug}`, { auth: false }).then(setData).catch(e => setErr(isApiError(e) && e.status === 404 ? 'This article was not found.' : 'Something went wrong')) }, [slug])
  usePageMeta(data?.post.seoTitle || data?.post.title || 'Article', { description: data?.post.seoDescription || data?.post.excerpt })
  if (err) return <section className="wrap sec"><h1 className="page-h">Article</h1><p className="alert" role="alert">{err}</p><Link to="/astrology-blog">Back to the blog</Link></section>
  if (!data) return <section className="wrap sec"><p className="muted">Loading…</p></section>
  const p = data.post
  const articleJsonLd = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'Article',
    headline: p.title, description: p.seoDescription || p.excerpt,
    image: p.coverImageUrl ? new URL(p.coverImageUrl, window.location.origin).href : undefined,
    author: { '@type': 'Person', name: p.authorName },
    datePublished: p.publishedAt || undefined,
    mainEntityOfPage: `${window.location.origin}/astrology-blog/${encodeURIComponent(p.slug)}`,
  }).replace(/</g, '\\u003c')
  return (
    <section className="wrap sec article-wrap">
      <script type="application/ld+json">{articleJsonLd}</script>
      {p.coverImageUrl && <img className="blog-cover blog-cover-hero" src={p.coverImageUrl} alt={p.title} />}
      <p className="muted small">{p.category} · {day(p.publishedAt)} · {p.authorName}</p>
      <h1 className="page-h">{p.title}</h1>
      {p.isSample && <p className="demo-tag">Sample article for testing</p>}
      <Article body={p.body ?? ''} />
      <p className="notice">Astrology is offered for guidance and reflection. It is not a substitute for medical, legal or financial advice.</p>
      {data.related.length > 0 && (
        <>
          <h2>Related articles</h2>
          <div className="bgrid">{data.related.map(r => <article className="bcard" key={r.slug}><h3><Link to={`/astrology-blog/${r.slug}`}>{r.title}</Link></h3><p>{r.excerpt}</p></article>)}</div>
        </>
      )}
    </section>
  )
}
