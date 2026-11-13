import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { config } from './config.js'
import { errorHandler, notFound, ok } from './http.js'
import { globalLimiter } from './middleware/rateLimit.js'
import { authRouter } from './routes/auth.js'
import { meRouter } from './routes/me.js'
import { toolsRouter } from './routes/tools.js'

export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', config.trustProxy)
  app.use(helmet())
  app.use(cors({ origin: config.corsOrigins }))
  app.use(express.json({ limit: '50kb' }))
  app.use('/api/v1', globalLimiter)

  app.get('/api/v1/health', (_req, res) => ok(res, { status: 'ok' }))
  app.use('/api/v1/auth', authRouter)
  app.use('/api/v1/me', meRouter)
  app.use('/api/v1/tools', toolsRouter)

  app.use(notFound)
  app.use(errorHandler)
  return app
}
