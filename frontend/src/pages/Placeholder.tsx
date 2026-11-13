import { Link, useLocation } from 'react-router-dom'
import { t } from '../data'
import { usePageMeta } from '../hooks'

export default function Placeholder() {
  const { pathname } = useLocation()
  const title = t(pathname.split('/').filter(Boolean).pop() || 'Page')
  usePageMeta(title, { noindex: true })
  return (<section className="wrap sec"><h1>{title}</h1><p className="lead">This page is built in a later phase. Route: <code>{pathname}</code></p><Link className="btn btn-gold" to="/">Back to home</Link></section>)
}
