import rateLimit from 'express-rate-limit'

const make = (windowMs: number, limit: number, message: string) =>
  rateLimit({
    windowMs, limit, standardHeaders: 'draft-7', legacyHeaders: false,
    handler: (_req, res) => { res.status(429).json({ success: false, error: { code: 'RATE_LIMITED', message } }) },
  })

export const globalLimiter = make(15 * 60 * 1000, 600, 'Too many requests. Please slow down.')
export const sendOtpLimiter = make(60 * 60 * 1000, 15, 'Too many code requests from this network. Try again later.')
export const authLimiter = make(15 * 60 * 1000, 40, 'Too many attempts. Please wait a few minutes.')
export const toolsLimiter = make(15 * 60 * 1000, 120, 'Too many chart requests. Please wait a few minutes.')
