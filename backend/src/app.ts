import cors from 'cors'
import { randomUUID } from 'node:crypto'
import express from 'express'
import helmet from 'helmet'
import { config } from './config.js'
import { errorHandler, notFound, ok } from './http.js'
import { globalLimiter } from './middleware/rateLimit.js'
import { authRouter } from './routes/auth.js'
import { meRouter } from './routes/me.js'
import { adminRouter } from './routes/admin.js'
import { astrologersRouter } from './routes/astrologers.js'
import { horoscopeRouter } from './routes/horoscope.js'
import { sessionsRouter } from './routes/sessions.js'
import { blogRouter } from './routes/blog.js'
import { supportRouter } from './routes/support.js'
import { toolsRouter } from './routes/tools.js'
import { festivalsRouter } from './routes/festivals.js'
import { couponsRouter, paymentsRouter, walletRouter } from './routes/wallet.js'

export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', config.trustProxy)
  app.use(helmet())
  app.use(cors({ origin: config.corsOrigins, exposedHeaders: ['X-Request-ID'] }))
  app.use((_req, res, next) => {
    res.locals.requestId = randomUUID()
    res.setHeader('X-Request-ID', res.locals.requestId)
    next()
  })
  const smallJson = express.json({ limit: '50kb' })
  app.use((req, res, next) => (req.path.startsWith('/api/v1/admin/') || req.path === '/api/v1/payments/webhook/razorpay' ? next() : smallJson(req, res, next)))
  app.use('/api/v1', globalLimiter)

  app.get('/api/v1/health', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    ok(res, { status: 'ok', uptimeSeconds: Math.floor(process.uptime()) })
  })
  app.use('/api/v1/auth', authRouter)
  app.use('/api/v1/me', meRouter)
  app.use('/api/v1/tools', toolsRouter)
  app.use('/api/v1/horoscope', horoscopeRouter)
  app.use('/api/v1/festivals', festivalsRouter)
  app.use('/api/v1/astrologers', astrologersRouter)
  app.use('/api/v1/wallet', walletRouter)
  app.use('/api/v1/coupons', couponsRouter)
  app.use('/api/v1/payments', paymentsRouter)
  app.use('/api/v1/sessions', sessionsRouter)
  app.use('/api/v1/blog', blogRouter)
  app.use('/api/v1/support', supportRouter)
  app.use('/api/v1/admin', adminRouter)

  app.use(notFound)
  app.use(errorHandler)
  return app
}
