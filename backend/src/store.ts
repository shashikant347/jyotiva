// Data store. Everything lives in memory (fast, simple) and is saved either to MongoDB (when MONGODB_URI is set and
// initStore() has connected) or to one JSON file. Call `await initStore()` once before serving requests.
// Phase 2 swaps this for PostgreSQL + Prisma (see plan section 7); keep the shapes below
// aligned with the plan's tables so the swap is mechanical.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { config } from './config.js'
import type { MongoConnection } from './mongo.js'
import { Syncer } from './persist.js'

import type { Gender, Language, ThemeMode, AdminRole, UserStatus, User, BirthProfile, SavedKundli, OtpRequest, RefreshToken, HoroscopePeriod, HoroscopeCategory, Horoscope, Festival, Astrologer, Review, BirthSnapshot, Session, ChatReportReason, ChatReport, ChatMessage, AvailabilityWatch, Notification, WebPushSubscription, Wallet, WalletTx, Payment, Coupon, TicketCategory, SupportTicket, SupportMessage, BlogPost, AuditLog, AstrologerPayout } from './models/types.js'
export type { Gender, Language, ThemeMode, AdminRole, UserStatus, User, BirthProfile, SavedKundli, OtpRequest, RefreshToken, HoroscopePeriod, HoroscopeCategory, Horoscope, Festival, Astrologer, Review, BirthSnapshot, Session, ChatReportReason, ChatReport, ChatMessage, AvailabilityWatch, Notification, WebPushSubscription, Wallet, WalletTx, Payment, Coupon, TicketCategory, SupportTicket, SupportMessage, BlogPost, AuditLog, AstrologerPayout } from './models/types.js'

export interface DB {
  users: User[]
  wallets: Wallet[]
  walletTxs: WalletTx[]
  payments: Payment[]
  coupons: Coupon[]
  auditLogs: AuditLog[]
  astrologers: Astrologer[]
  reviews: Review[]
  sessions: Session[]
  chatReports: ChatReport[]
  messages: ChatMessage[]
  availabilityWatches: AvailabilityWatch[]
  notifications: Notification[]
  webPushSubscriptions: WebPushSubscription[]
  freeChatPhones: string[] // HMAC of phone numbers that already used the free chat (survives account deletion)
  horoscopes: Horoscope[]
  festivals: Festival[]
  birthProfiles: BirthProfile[]
  savedKundlis: SavedKundli[]
  otps: OtpRequest[]
  refreshTokens: RefreshToken[]
  supportTickets: SupportTicket[]
  supportMessages: SupportMessage[]
  blogPosts: BlogPost[]
  astrologerPayouts: AstrologerPayout[]
}

const empty = (): DB => ({ users: [], wallets: [], walletTxs: [], payments: [], coupons: [], auditLogs: [], astrologers: [], reviews: [], sessions: [], chatReports: [], messages: [], availabilityWatches: [], notifications: [], webPushSubscriptions: [], freeChatPhones: [], horoscopes: [], festivals: [], birthProfiles: [], savedKundlis: [], otps: [], refreshTokens: [], supportTickets: [], supportMessages: [], blogPosts: [], astrologerPayouts: [] })

const backupFile = `${config.dataFile}.bak`

function readDb(file: string): DB {
  const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf8'))
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(`Invalid data format in ${file}`)
  return { ...empty(), ...parsed as Partial<DB> }
}

function writeJsonAtomically(file: string, value: unknown): void {
  const tmp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(value), { mode: 0o600, flag: 'w' })
  fs.chmodSync(tmp, 0o600)
  fs.renameSync(tmp, file)
}

function load(): DB {
  try {
    return readDb(config.dataFile)
  } catch (primaryError) {
    const code = (primaryError as NodeJS.ErrnoException).code
    // A missing file is a valid first run; malformed JSON is recoverable only from a prior good snapshot.
    if (code !== 'ENOENT' && !(primaryError instanceof SyntaxError)) throw primaryError
    try {
      const recovered = readDb(backupFile)
      console.warn(`Primary data file ${config.dataFile} is ${code === 'ENOENT' ? 'missing' : 'invalid'}; restoring the last good backup`)
      writeJsonAtomically(config.dataFile, recovered)
      return recovered
    } catch (backupError) {
      if (code === 'ENOENT' && (backupError as NodeJS.ErrnoException).code === 'ENOENT') return empty()
      throw new AggregateError([primaryError, backupError], `Could not load ${config.dataFile} or its recovery backup`)
    }
  }
}

// When MongoDB is configured it is authoritative; do not even depend on the legacy JSON file at startup.
const db: DB = config.mongoUri ? empty() : load()
export const getDb = (): DB => db
export const newId = (): string => crypto.randomUUID()

let timer: NodeJS.Timeout | null = null

// Unique key of each collection (wallets are one per user; freeChatPhones is a plain list of strings).
const KEYS = {
  users: 'id', wallets: 'userId', walletTxs: 'id', payments: 'id', coupons: 'code', auditLogs: 'id', astrologers: 'id', reviews: 'id',
  sessions: 'id', chatReports: 'id', messages: 'id', availabilityWatches: 'id', notifications: 'id', webPushSubscriptions: 'id', freeChatPhones: null, horoscopes: 'id', festivals: 'id', birthProfiles: 'id', savedKundlis: 'id', otps: 'id', refreshTokens: 'id', supportTickets: 'id', supportMessages: 'id', blogPosts: 'id', astrologerPayouts: 'id',
} satisfies Record<keyof DB, string | null>
let mongo: MongoConnection | null = null
let syncer: Syncer | null = null
let flushing: Promise<void> | null = null
let dirty = false
let closing = false

function flushFile(): void {
  const dir = path.dirname(config.dataFile)
  fs.mkdirSync(dir, { recursive: true })
  if (fs.existsSync(config.dataFile)) {
    const backupTmp = `${backupFile}.${process.pid}.tmp`
    fs.copyFileSync(config.dataFile, backupTmp)
    fs.chmodSync(backupTmp, 0o600)
    fs.renameSync(backupTmp, backupFile)
  }
  writeJsonAtomically(config.dataFile, db) // primary and backup hold phone numbers and birth data
}

/** Save now. Resolves when the data is written (MongoDB writes are asynchronous, so await this on shutdown). */
export function flushNow(): Promise<void> {
  if (timer) { clearTimeout(timer); timer = null }
  if (!syncer) { flushFile(); return Promise.resolve() }
  dirty = true
  if (flushing) return flushing // the running flush loops until nothing is dirty
  flushing = (async () => {
    try {
      while (dirty) {
        dirty = false
        try { await syncer!.flush(db as unknown as Record<string, unknown[]>) } catch (e) {
          console.error('MongoDB save failed:', (e as Error).message)
          const mongoError = e as { name?: string; validationErrors?: unknown[] }
          if (closing || mongoError.name === 'ValidationError' || mongoError.name === 'CastError' || mongoError.name === 'StrictModeError' || (mongoError.validationErrors?.length ?? 0) > 0) throw e
          dirty = true
          await new Promise(r => setTimeout(r, 2000))
        }
      }
    } finally { flushing = null }
  })()
  return flushing
}

export function save(): void {
  if (timer) return
  timer = setTimeout(() => { timer = null; void flushNow() }, 150)
  timer.unref()
}

/**
 * Connect to MongoDB when configured and load every model collection into memory. MongoDB is authoritative.
 * If MongoDB is entirely empty, legacy local JSON data is imported once; without a URI, local JSON is used.
 */
export async function initStore(): Promise<'mongodb' | 'file'> {
  if (!config.mongoUri) return 'file'
  const { connectMongo } = await import('./mongo.js') // loaded only when MongoDB is used
  mongo = await connectMongo(config.mongoUri, config.mongoDb)
  const s = new Syncer(mongo, KEYS)
  const loaded = await s.load()
  const total = Object.values(loaded).reduce((n, a) => n + a.length, 0)
  if (total > 0) {
    for (const k of Object.keys(KEYS)) {
      const arr = (db as unknown as Record<string, unknown[]>)[k]
      arr.length = 0
      for (const item of loaded[k]) arr.push(item)
    }
  } else {
    const legacy = load()
    const legacyData = legacy as unknown as Record<string, unknown[]>
    const legacyCount = Object.values(legacyData).reduce((n, items) => n + items.length, 0)
    if (legacyCount > 0) {
      for (const k of Object.keys(KEYS)) {
        const target = (db as unknown as Record<string, unknown[]>)[k]
        target.push(...legacyData[k])
      }
      console.log(`MongoDB is empty: importing ${legacyCount} legacy records from the local JSON file`)
    }
  }
  syncer = s
  await flushNow()
  return 'mongodb'
}

export async function closeStore(): Promise<void> {
  closing = true
  await flushNow()
  if (mongo) await mongo.close()
}

/** Drop expired/old OTP and refresh-token rows so the file does not grow forever. */
export function prune(now = Date.now()): void {
  const day = 24 * 60 * 60 * 1000
  db.otps = db.otps.filter(o => now - o.createdAt < day)
  db.refreshTokens = db.refreshTokens.filter(t => t.expiresAt > now && !(t.revokedAt && now - t.revokedAt > 7 * day))
  db.notifications = db.notifications.filter(n => now - Date.parse(n.createdAt) < 90 * day)
  db.availabilityWatches = db.availabilityWatches.filter(w => w.active || now - Date.parse(w.createdAt) < 90 * day)
  save()
}
