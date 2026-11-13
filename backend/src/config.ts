import crypto from 'node:crypto'

const isProd = process.env.NODE_ENV === 'production'

function secret(name: string): string {
  const v = process.env[name]
  if (v && v.length >= 32) return v
  if (isProd) throw new Error(`${name} must be set to 32+ random characters in production`)
  // Stable, clearly-dev-only fallback so local restarts keep sessions alive.
  return crypto.createHash('sha256').update('dev-only-' + name).digest('hex')
}

export const config = {
  isProd,
  port: Number(process.env.PORT ?? 4000),
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(',').map(s => s.trim()).filter(Boolean),
  trustProxy: Number(process.env.TRUST_PROXY ?? 0),
  jwtSecret: secret('JWT_SECRET'),
  otpSecret: secret('OTP_SECRET'),
  accessTtlSec: 15 * 60,
  refreshTtlMs: 30 * 24 * 60 * 60 * 1000,
  otpTtlMs: 5 * 60 * 1000,
  otpMaxAttempts: 5,
  otpMaxPerHour: 5,
  otpResendCooldownMs: 30 * 1000,
  maxBirthProfiles: 20,
  dataFile: process.env.DATA_FILE ?? 'data/db.json',
  exposeDevOtp: !isProd && process.env.EXPOSE_DEV_OTP !== 'false',
}
