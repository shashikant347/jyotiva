// Development data store: one JSON file behind a tiny API.
// Phase 2 swaps this for PostgreSQL + Prisma (see plan section 7); keep the shapes below
// aligned with the plan's tables so the swap is mechanical.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { config } from './config.js'

export type Gender = 'male' | 'female' | 'other'
export type Language = 'en' | 'hi'
export type ThemeMode = 'light' | 'dark' | 'auto'

export interface User {
  id: string
  phone: string
  email: string | null
  name: string
  gender: Gender | null
  photoUrl: string | null
  language: Language
  theme: ThemeMode
  role: 'user' | 'astrologer' | 'admin'
  freeChatUsed: boolean
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface BirthProfile {
  id: string
  userId: string
  name: string
  gender: Gender
  birthDate: string // YYYY-MM-DD
  birthTime: string | null // HH:MM, null when unknown
  birthPlace: string
  latitude: number | null
  longitude: number | null
  timezone: string
  isPrimary: boolean
  createdAt: string
}

export interface OtpRequest {
  id: string
  phone: string
  codeHash: string
  expiresAt: number
  attempts: number
  createdAt: number
  consumed: boolean
}

export interface RefreshToken {
  id: string
  userId: string
  familyId: string
  tokenHash: string
  device: string
  ip: string
  createdAt: number
  expiresAt: number
  revokedAt: number | null
}

interface DB {
  users: User[]
  birthProfiles: BirthProfile[]
  otps: OtpRequest[]
  refreshTokens: RefreshToken[]
}

const empty = (): DB => ({ users: [], birthProfiles: [], otps: [], refreshTokens: [] })

function load(): DB {
  try {
    return { ...empty(), ...JSON.parse(fs.readFileSync(config.dataFile, 'utf8')) }
  } catch (e) {
    // Only a missing file means "start fresh". Anything else (corrupt JSON, permissions)
    // must stop the server rather than silently overwrite real data on the next save.
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return empty()
    throw e
  }
}

const db: DB = load()
export const getDb = (): DB => db
export const newId = (): string => crypto.randomUUID()

let timer: NodeJS.Timeout | null = null

export function flushNow(): void {
  if (timer) { clearTimeout(timer); timer = null }
  const dir = path.dirname(config.dataFile)
  fs.mkdirSync(dir, { recursive: true })
  const tmp = config.dataFile + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(db), { mode: 0o600 }) // file holds phone numbers and birth data
  fs.renameSync(tmp, config.dataFile)
}

export function save(): void {
  if (timer) return
  timer = setTimeout(() => { timer = null; flushNow() }, 150)
  timer.unref()
}

/** Drop expired/old OTP and refresh-token rows so the file does not grow forever. */
export function prune(now = Date.now()): void {
  const day = 24 * 60 * 60 * 1000
  db.otps = db.otps.filter(o => now - o.createdAt < day)
  db.refreshTokens = db.refreshTokens.filter(t => t.expiresAt > now && !(t.revokedAt && now - t.revokedAt > 7 * day))
  save()
}
