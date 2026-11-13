import { useEffect } from 'react'
import { BRAND } from './data'

/** Sets the document title and robots meta for the current page. */
export function usePageMeta(title: string, opts: { noindex?: boolean; description?: string } = {}) {
  useEffect(() => {
    const prev = document.title
    document.title = title ? `${title} | ${BRAND}` : prev
    let robots = document.querySelector<HTMLMetaElement>('meta[name=robots]')
    const created = !robots
    if (opts.noindex) {
      if (!robots) { robots = document.createElement('meta'); robots.name = 'robots'; document.head.appendChild(robots) }
      robots.content = 'noindex'
    }
    let desc = document.querySelector<HTMLMetaElement>('meta[name=description]')
    const prevDesc = desc?.content
    if (opts.description && desc) desc.content = opts.description
    return () => {
      document.title = prev
      if (opts.noindex && robots) { if (created) robots.remove(); else robots.content = 'index,follow' }
      if (opts.description && desc && prevDesc !== undefined) desc.content = prevDesc
    }
  }, [title, opts.noindex, opts.description])
}
