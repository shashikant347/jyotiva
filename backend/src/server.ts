import { config } from './config.js'
import { createApp } from './app.js'
import { flushNow, prune } from './store.js'

prune()
setInterval(() => prune(), 60 * 60 * 1000).unref()

const server = createApp().listen(config.port, () => {
  console.log(`Jyotiva API on http://localhost:${config.port}/api/v1 (${config.isProd ? 'production' : 'development'})`)
})

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => { flushNow(); server.close(() => process.exit(0)) })
}
