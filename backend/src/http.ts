import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from 'express'
import { ZodError } from 'zod'
import { HttpError } from './errors.js'

export const ok = (res: Response, data: unknown, status = 200): void => {
  res.status(status).json({ success: true, data })
}

export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => { fn(req, res, next).catch(next) }

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } })
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    const issues = err.issues.map(i => ({ path: i.path.join('.'), message: i.message }))
    res.status(400).json({ success: false, error: { code: 'VALIDATION', message: issues[0]?.message ?? 'Invalid request', details: issues } })
    return
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ success: false, error: { code: err.code, message: err.message, ...err.extra } })
    return
  }
  // body-parser errors (bad JSON, too large)
  const status = (err as { status?: number }).status
  if (status === 400 || status === 413) {
    res.status(status).json({ success: false, error: { code: status === 413 ? 'TOO_LARGE' : 'BAD_JSON', message: 'Invalid request body' } })
    return
  }
  console.error(err)
  res.status(500).json({ success: false, error: { code: 'INTERNAL', message: 'Something went wrong' } })
}
