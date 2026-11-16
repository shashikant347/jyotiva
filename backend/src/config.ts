import crypto from 'node:crypto'
import { z } from 'zod'

// Load backend/.env when it exists (Node 20.12+). Values already set in the environment win.
try { process.loadEnvFile() } catch { /* no .env file: use defaults */ }

const isProd = process.env.NODE_ENV === 'production'

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  CORS_ORIGINS: z.string().default('http://localhost:5173').transform(value => value.split(',').map(s => s.trim()).filter(Boolean)).refine(origins => origins.length > 0 && origins.every(origin => {
    try { const url = new URL(origin); return (url.protocol === 'http:' || url.protocol === 'https:') && url.origin === origin }
    catch { return false }
  }), 'CORS_ORIGINS must be a comma-separated list of bare http(s) origins'),
  TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(0),
  PLATFORM_COMMISSION_PERCENT: z.coerce.number().int().min(0).max(100).default(30),
  FREE_CHAT_SECONDS: z.coerce.number().int().min(1).max(3600).default(300),
  FREE_CHAT_PAYOUT_PAISE: z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0),
  EXPOSE_DEV_OTP: z.enum(['true', 'false']).default('true'),
  MONGODB_URI: z.string().default('').refine(value => !value || value.startsWith('mongodb://') || value.startsWith('mongodb+srv://'), 'MONGODB_URI must use mongodb:// or mongodb+srv://'),
  MONGODB_DB: z.string().min(1).max(63).regex(/^[A-Za-z0-9_-]+$/).default('jyotiva'),
  RAZORPAY_KEY_ID: z.string().default(''), RAZORPAY_KEY_SECRET: z.string().default(''), RAZORPAY_WEBHOOK_SECRET: z.string().default(''),
  VAPID_PUBLIC_KEY: z.string().default(''), VAPID_PRIVATE_KEY: z.string().default(''), VAPID_SUBJECT: z.string().default(''),
}).superRefine((v, ctx) => {
  if (Boolean(v.RAZORPAY_KEY_ID) !== Boolean(v.RAZORPAY_KEY_SECRET)) ctx.addIssue({ code: 'custom', message: 'Set both Razorpay checkout keys together, or leave both empty', path: ['RAZORPAY_KEY_ID'] })
  const vapid = [v.VAPID_PUBLIC_KEY, v.VAPID_PRIVATE_KEY, v.VAPID_SUBJECT]
  if (vapid.some(Boolean) && !vapid.every(Boolean)) ctx.addIssue({ code: 'custom', message: 'Set all three VAPID variables together, or leave all three empty', path: ['VAPID_PUBLIC_KEY'] })
})
const env = envSchema.parse(process.env)
if (isProd && !process.env.CORS_ORIGINS?.trim()) throw new Error('CORS_ORIGINS must list the production web app origin')
if (isProd && env.CORS_ORIGINS.some(origin => !origin.startsWith('https://'))) throw new Error('Production CORS_ORIGINS must use HTTPS')
if (isProd && !env.MONGODB_URI) throw new Error('MONGODB_URI is required in production; local JSON storage is development-only')

function secret(name: string): string {
  const v = process.env[name]
  if (v && v.length >= 32) return v
  if (v) throw new Error(`${name} must be at least 32 characters when provided`)
  if (isProd) throw new Error(`${name} must be set to 32+ random characters in production`)
  // Stable, clearly-dev-only fallback so local restarts keep sessions alive.
  return crypto.createHash('sha256').update('dev-only-' + name).digest('hex')
}

export const config = {
  isProd,
  port: env.PORT,
  corsOrigins: env.CORS_ORIGINS,
  trustProxy: env.TRUST_PROXY,
  jwtSecret: secret('JWT_SECRET'),
  otpSecret: secret('OTP_SECRET'),
  accessTtlSec: 15 * 60,
  refreshTtlMs: 30 * 24 * 60 * 60 * 1000,
  otpTtlMs: 5 * 60 * 1000,
  otpMaxAttempts: 5,
  otpMaxPerHour: 5,
  otpResendCooldownMs: 30 * 1000,
  maxBirthProfiles: 20,
  // Payments. With no Razorpay keys the API runs in "mock" mode (development only; disabled in production).
  razorpayKeyId: env.RAZORPAY_KEY_ID,
  razorpayKeySecret: env.RAZORPAY_KEY_SECRET,
  razorpayWebhookSecret: env.RAZORPAY_WEBHOOK_SECRET,
  minRechargePaise: 1000, // Rs 10
  maxRechargePaise: 5_000_000, // Rs 50,000
  // Comma-separated phone numbers (same +91... format as stored) that get the admin role when they sign in.
  adminPhones: (process.env.ADMIN_PHONES ?? '').split(',').map(s => s.trim()).filter(Boolean),
  // Chat sessions (Phase 7)
  platformCommissionPercent: env.PLATFORM_COMMISSION_PERCENT,
  freeChatSeconds: env.FREE_CHAT_SECONDS,
  // What the platform pays an astrologer for a free chat. Business decision (plan 6.5), default 0.
  freeChatPayoutPaise: env.FREE_CHAT_PAYOUT_PAISE,
  // Development only: demo astrologers auto-accept and reply with a clearly labelled canned message.
  demoBot: !isProd && process.env.DEMO_BOT !== 'false',
  dataFile: process.env.DATA_FILE ?? 'data/db.json',
  // MongoDB (Atlas). When set, all data is stored there; when empty, the JSON file above is used (tests, quick local runs).
  mongoUri: env.MONGODB_URI,
  mongoDb: env.MONGODB_DB,
  redisUrl: process.env.REDIS_URL ?? '',
  vapidPublicKey: env.VAPID_PUBLIC_KEY,
  vapidPrivateKey: env.VAPID_PRIVATE_KEY,
  vapidSubject: env.VAPID_SUBJECT,
  exposeDevOtp: !isProd && env.EXPOSE_DEV_OTP === 'true',
}
