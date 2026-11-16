self.addEventListener('push', event => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = { body: event.data?.text() ?? '' } }
  const title = typeof data.title === 'string' ? data.title : 'Jyotiva'
  const options = {
    body: typeof data.body === 'string' ? data.body : 'You have a new notification.',
    data: { href: typeof data.href === 'string' ? data.href : '/' },
    tag: 'jyotiva-notification',
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const href = event.notification.data?.href
  const target = new URL(typeof href === 'string' ? href : '/', self.location.origin)
  if (target.origin !== self.location.origin) target.pathname = '/'
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
    const existing = windows.find(client => new URL(client.url).origin === self.location.origin)
    if (existing) return existing.navigate(target.href).then(client => client?.focus())
    return self.clients.openWindow(target.href)
  }))
})
