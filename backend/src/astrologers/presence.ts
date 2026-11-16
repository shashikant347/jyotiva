import { EventEmitter } from 'node:events'
import { createClient } from 'redis'
import { config } from '../config.js'
import { getDb, save, type Astrologer } from '../store.js'

const REDIS_TTL_SECONDS = 60
const REDIS_HEARTBEAT_MS = 15_000
const REDIS_POLL_MS = 5_000
const ONLINE_USERS_KEY = 'jyotiva:presence:astrologers:online'
const redisKey = (userId: string) => `jyotiva:presence:astrologer:${userId}`
const RECONCILE_USER_SCRIPT = `
  redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
  if redis.call('ZCARD', KEYS[1]) > 0 then
    redis.call('SADD', KEYS[2], ARGV[2])
    return 1
  end
  redis.call('SREM', KEYS[2], ARGV[2])
  return 0
`
const REMOVE_SOCKET_SCRIPT = `
  redis.call('ZREM', KEYS[1], ARGV[1])
  redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[2])
  if redis.call('ZCARD', KEYS[1]) > 0 then
    redis.call('SADD', KEYS[2], ARGV[3])
    return 1
  end
  redis.call('SREM', KEYS[2], ARGV[3])
  return 0
`
const socketsByUser = new Map<string, Set<string>>()
const remoteOnline = new Set<string>()
let trackingEnabled = false
let redisClient: ReturnType<typeof createClient> | null = null
let redisTimer: ReturnType<typeof setInterval> | null = null
let redisPollTimer: ReturnType<typeof setInterval> | null = null
export const presenceBus = new EventEmitter()

const logRedisError = (e: Error) => console.error('Redis presence error:', e.message)

async function publishSocket(userId: string, socketId: string): Promise<void> {
  if (!redisClient?.isReady) return
  const key = redisKey(userId)
  await redisClient.zAdd(key, { score: Date.now(), value: socketId })
  await redisClient.expire(key, REDIS_TTL_SECONDS)
  await redisClient.sAdd(ONLINE_USERS_KEY, userId)
}

async function refreshRemotePresence(): Promise<void> {
  const client = redisClient
  if (!client?.isReady) return
  const now = Date.now(), cutoff = now - REDIS_TTL_SECONDS * 1000
  const users = await client.sMembers(ONLINE_USERS_KEY)
  const active = await Promise.all(users.map(async userId => {
    const result = await client.eval(RECONCILE_USER_SCRIPT, {
      keys: [redisKey(userId), ONLINE_USERS_KEY], arguments: [String(cutoff), userId],
    })
    return { userId, active: result === 1 }
  }))
  remoteOnline.clear()
  for (const entry of active) if (entry.active) remoteOnline.add(entry.userId)
}

async function pulseRedisPresence(): Promise<void> {
  const writes: Promise<void>[] = []
  for (const [userId, socketIds] of socketsByUser) for (const socketId of socketIds) writes.push(publishSocket(userId, socketId))
  await Promise.all(writes)
  await refreshRemotePresence()
}

/** Connect once per API process. Without REDIS_URL, presence stays process-local for development. */
export async function initRedisPresence(): Promise<boolean> {
  trackingEnabled = true
  if (!config.redisUrl) return false
  const client = createClient({
    url: config.redisUrl,
    socket: { reconnectStrategy: retries => retries < 5 ? Math.min(retries * 500, 2000) : false },
  }) as NonNullable<typeof redisClient>
  client.on('error', logRedisError)
  try { await client.connect() } catch (e) { client.destroy(); throw e }
  redisClient = client
  await refreshRemotePresence()
  redisTimer = setInterval(() => { void pulseRedisPresence().catch(logRedisError) }, REDIS_HEARTBEAT_MS)
  redisPollTimer = setInterval(() => { void refreshRemotePresence().catch(logRedisError) }, REDIS_POLL_MS)
  redisTimer.unref()
  redisPollTimer.unref()
  return true
}

export async function closeRedisPresence(): Promise<void> {
  if (redisTimer) clearInterval(redisTimer)
  if (redisPollTimer) clearInterval(redisPollTimer)
  redisTimer = null
  redisPollTimer = null
  if (redisClient) {
    const client = redisClient
    redisClient = null
    if (client.isOpen) await client.close()
  }
}

export function enablePresenceTracking(): void {
  trackingEnabled = true
}

export function resetPresenceAfterRestart(): number {
  trackingEnabled = true
  socketsByUser.clear()
  // A different API instance may still have live sockets, so Redis-backed
  // restarts must keep the astrologer's saved online preference.
  if (redisClient?.isReady) return 0
  remoteOnline.clear()
  let changed = 0
  for (const astrologer of getDb().astrologers) {
    if (!astrologer.isDemo && astrologer.isOnline) {
      astrologer.isOnline = false
      astrologer.updatedAt = new Date().toISOString()
      changed++
    }
  }
  if (changed) save()
  return changed
}

export function hasLiveAstrologerSocket(userId: string): boolean {
  return (socketsByUser.get(userId)?.size ?? 0) > 0 || (!!redisClient?.isReady && remoteOnline.has(userId))
}

export function isAstrologerLive(astrologer: Astrologer): boolean {
  if (!astrologer.isOnline) return false
  if (astrologer.isDemo || !astrologer.userId || !trackingEnabled) return true
  return hasLiveAstrologerSocket(astrologer.userId)
}

export function registerAstrologerSocket(userId: string, socketId: string): void {
  const astrologer = getDb().astrologers.find(a => a.userId === userId && a.status === 'approved')
  if (!astrologer) return
  const sockets = socketsByUser.get(userId) ?? new Set<string>()
  const wasDisconnected = sockets.size === 0
  sockets.add(socketId)
  socketsByUser.set(userId, sockets)
  if (wasDisconnected && astrologer.isOnline) presenceBus.emit('online', astrologer.id)
  void publishSocket(userId, socketId).catch(logRedisError)
}

export function unregisterAstrologerSocket(userId: string, socketId: string): void {
  const sockets = socketsByUser.get(userId)
  if (!sockets) return
  sockets.delete(socketId)
  if (redisClient?.isReady) {
    const client = redisClient, key = redisKey(userId)
    void client.eval(REMOVE_SOCKET_SCRIPT, {
      keys: [key, ONLINE_USERS_KEY],
      arguments: [socketId, String(Date.now() - REDIS_TTL_SECONDS * 1000), userId],
    }).then(() => refreshRemotePresence())
      .catch(logRedisError)
  }
  if (sockets.size) return
  socketsByUser.delete(userId)
}
