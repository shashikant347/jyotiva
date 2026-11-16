import { config } from './config.js'
import { createApp } from './app.js'
import { seedDemoAstrologers } from './astrologers/seed.js'
import { seedSampleBlog } from './blog/seed.js'
import { seedPreviewAstrologers } from './astrologers/seedPreview.js'
import { attachSockets } from './sessions/socket.js'
import { recoverSessions, tick } from './sessions/service.js'
import { closeStore, initStore, prune } from './store.js'
import { publishDueHoroscopes } from './horoscope/scheduler.js'
import { seedAllDemoCollections, seedDemoContent } from './demoSeed.js'
import { closeRedisPresence, initRedisPresence, resetPresenceAfterRestart } from './astrologers/presence.js'
import { initWebPush } from './notifications/push.js'

const mode = await initStore()
const webPushEnabled = initWebPush()
if (webPushEnabled) console.log('Browser push notifications are configured')
console.log(mode === 'mongodb' ? `Data store: MongoDB (database "${config.mongoDb}")` : `Data store: local file ${config.dataFile} (set MONGODB_URI in backend/.env to use MongoDB Atlas)`)
prune()
const scheduled = publishDueHoroscopes()
if (scheduled) console.log(`Published ${scheduled} scheduled horoscope entries`)
// Demo astrologers help you build and test. Never seeded in production unless SEED_DEMO=true is set on purpose.
if (process.env.SEED_DEMO === 'true' || (!config.isProd && process.env.SEED_DEMO !== 'false')) {
  const n = seedDemoAstrologers()
  if (n) console.log(`Seeded ${n} DEMO astrologers (remove with DELETE /api/v1/admin/astrologers/demo)`)
  const m = seedPreviewAstrologers()
  if (m) console.log(`Added ${m} more DEMO astrologers with sample ratings for the listing preview`)
  const b = seedSampleBlog()
  if (b) console.log(`Added ${b} sample blog articles (edit or delete them in /admin/blog)`)
  const demoContent = seedDemoContent()
  if (demoContent.horoscopes || demoContent.festivals) console.log(`Refreshed preview data: ${demoContent.horoscopes} sample horoscopes, ${demoContent.festivals} fictional festival cards`)
  if (process.env.SEED_ALL_DEMO === 'true' && !config.isProd) {
    const seeded = seedAllDemoCollections()
    console.log(`Added DEMO preview records across collections: ${Object.entries(seeded).filter(([, n]) => n > 0).map(([name, n]) => `${name}=${n}`).join(', ') || 'already present'}`)
  }
}
try {
  const sharedPresence = await initRedisPresence()
  if (sharedPresence) console.log('Astrologer presence: shared through Redis')
  else console.log('Astrologer presence: single API process (set REDIS_URL to share across instances)')
} catch (e) {
  if (config.isProd) throw e
  console.warn('Redis is unavailable; using single-process astrologer presence:', (e as Error).message)
}
const staleOnline = resetPresenceAfterRestart()
if (staleOnline) console.log(`Reset ${staleOnline} astrologer presence record(s) after restart`)
const closed = recoverSessions()
if (closed) console.log(`Closed ${closed} chat(s) left open by the last shutdown`)
const sessionTimer = setInterval(() => tick(), 1000)
const pruneTimer = setInterval(() => prune(), 60 * 60 * 1000)
const horoscopeTimer = setInterval(() => publishDueHoroscopes(), 60 * 1000)
sessionTimer.unref(); pruneTimer.unref(); horoscopeTimer.unref()

const server = createApp().listen(config.port, () => {
  console.log(`Jyotiva API on http://localhost:${config.port}/api/v1 (${config.isProd ? 'production' : 'development'})`)
})

const io = attachSockets(server)

let shuttingDown = false
async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`${signal} received; stopping API gracefully`)
  clearInterval(sessionTimer); clearInterval(pruneTimer); clearInterval(horoscopeTimer)

  const forceExit = setTimeout(() => {
    console.error('Graceful shutdown timed out after 30 seconds')
    process.exit(1)
  }, 30_000)
  forceExit.unref()

  io.close(async () => {
    try {
      const results = await Promise.allSettled([closeRedisPresence(), closeStore()])
      const failures = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected')
      if (failures.length) throw new AggregateError(failures.map(result => result.reason), 'One or more services failed to close cleanly')
      clearTimeout(forceExit)
      console.log('API shutdown complete')
      process.exit(0)
    } catch (error) {
      clearTimeout(forceExit)
      console.error('API shutdown failed:', error)
      process.exit(1)
    }
  })
}

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.once(sig, () => { void shutdown(sig) })
}
