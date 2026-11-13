import { Link, useLocation } from 'react-router-dom'
import { usePageMeta } from '../hooks'

export default function NotFound() {
  const { pathname } = useLocation()
  usePageMeta('Page not found', { noindex: true })
  return (
    <section className="wrap sec notfound">
      <p className="nf-code" aria-hidden>404</p>
      <h1 className="page-h">We could not find that page</h1>
      <p className="lead">Nothing lives at <code>{pathname}</code>. It may have moved, or the link may be mistyped.</p>
      <div className="row">
        <Link className="btn btn-gold" to="/">Back to home</Link>
        <Link className="btn btn-line" to="/freekundli">Free Kundli</Link>
        <Link className="btn btn-line" to="/horoscope/daily-horoscope">Daily horoscope</Link>
      </div>
    </section>
  )
}
