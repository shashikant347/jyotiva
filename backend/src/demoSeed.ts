import { SIGNS } from './astro/data.js'
import crypto from 'node:crypto'
import { config } from './config.js'
import { getDb, newId, save, type Festival, type Horoscope, type HoroscopeCategory, type HoroscopePeriod } from './store.js'

const CATEGORIES: HoroscopeCategory[] = ['general', 'love', 'career', 'finance', 'health']
const PERIODS: HoroscopePeriod[] = ['daily', 'weekly', 'monthly', 'yearly']
const categoryText: Record<HoroscopeCategory, string> = {
  general: 'Use a small pause to notice what is working and choose one practical next step.',
  love: 'A clear, kind conversation can help you understand another point of view.',
  career: 'Focus on one useful task and make expectations clear before taking on more.',
  finance: 'Review a routine expense and give yourself time before making a larger purchase.',
  health: 'A steady routine and a little rest can support your general sense of wellbeing.',
}
const periodLabel: Record<HoroscopePeriod, string> = { daily: 'Today', weekly: 'This week', monthly: 'This month', yearly: 'This year' }
const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400_000).toISOString().slice(0, 10)

/** Explicitly labelled, fictional content for local UI previews only. Never called in production. */
export function seedDemoContent(now = new Date()): { horoscopes: number; festivals: number } {
  const db = getDb()
  // Refresh only records owned by this preview seeder so dates stay current.
  db.horoscopes = db.horoscopes.filter(h => !h.isSample)
  db.festivals = db.festivals.filter(f => !f.isSample)
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now)
  let horoscopes = 0
  for (let sign = 0; sign < SIGNS.length; sign++) for (const category of CATEGORIES) for (const period of PERIODS) {
    const from = period === 'daily' ? addDays(today, -1) : period === 'weekly' ? addDays(today, -3) : period === 'monthly' ? `${today.slice(0, 7)}-01` : `${today.slice(0, 4)}-01-01`
    const to = period === 'daily' ? addDays(today, 1) : period === 'weekly' ? addDays(from, 6) : period === 'monthly' ? `${today.slice(0, 7)}-${new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7), 0)).getUTCDate()}` : `${today.slice(0, 4)}-12-31`
    const item: Horoscope = {
      id: newId(), sign, period, category, language: 'en', dateFrom: from, dateTo: to,
      text: `[DEMO PREVIEW ONLY — replace with editor-written content] ${periodLabel[period]}, ${categoryText[category]}`,
      luckyNumber: (sign + 3) % 9 + 1, luckyColor: ['Blue', 'Green', 'Gold', 'White'][sign % 4], mood: 'Reflective',
      loveScore: 3, careerScore: 4, healthScore: 3, moneyScore: 3, status: 'published', isSample: true,
      createdAt: now.toISOString(), updatedAt: now.toISOString(),
    }
    db.horoscopes.push(item); horoscopes++
  }

  // These are intentionally unmistakable preview placeholders, not actual festival dates.
  let festivals = 0
  const year = today.slice(0, 4)
  const examples: Pick<Festival, 'slug' | 'title' | 'date' | 'region' | 'language' | 'tithi' | 'paksha' | 'description'>[] = [
    { slug: 'demo-festival-preview-one', title: 'DEMO ONLY — Festival card preview 1', date: `${year}-04-01`, region: 'Preview only', language: 'en', tithi: '', paksha: '', description: 'This is fictional placeholder content used to preview the festival layout. It is not a real festival or date.' },
    { slug: 'demo-festival-preview-two', title: 'DEMO ONLY — Festival card preview 2', date: `${year}-08-15`, region: 'Preview only', language: 'en', tithi: '', paksha: '', description: 'This is fictional placeholder content used to preview the festival detail layout. It is not a real festival or date.' },
    { slug: 'demo-festival-preview-three', title: 'DEMO ONLY — Festival card preview 3', date: `${year}-12-01`, region: 'Preview only', language: 'en', tithi: '', paksha: '', description: 'This is fictional placeholder content used to preview the festival calendar. It is not a real festival or date.' },
  ]
  for (const example of examples) {
    db.festivals.push({ id: newId(), ...example, status: 'published', isSample: true, createdAt: now.toISOString(), updatedAt: now.toISOString() })
    festivals++
  }
  if (horoscopes || festivals) save()
  return { horoscopes, festivals }
}

/**
 * Add linked, clearly-labelled records to every remaining collection for local UI previews.
 * IDs are stable so restarting the development server never duplicates these fixtures.
 * Security and payment records are deliberately expired/revoked/failed; no live credentials,
 * active chats, real payment captures, or pending payouts are created.
 */
export function seedAllDemoCollections(now = new Date()): Record<string, number> {
  if (config.isProd) return {}
  const db = getDb()
  const stamp = now.toISOString()
  const epoch = now.getTime()
  const id = (key: string) => `demo-seed:${key}`
  const exists = (items: Array<{ id: string }>, key: string) => items.some(item => item.id === id(key))
  const count: Record<string, number> = {}
  const add = (collection: string, didAdd: boolean) => { count[collection] = (count[collection] ?? 0) + Number(didAdd) }

  const userId = id('user:maya')
  const secondUserId = id('user:arjun')
  const astroUserId = id('user:astrologer')
  const demoAstrologerId = id('astrologer:profile')
  const sessionId = id('session:ended')
  const supportTicketId = id('support:open')
  const astro = db.astrologers.find(a => a.isDemo && a.status === 'approved')
  const astroId = astro?.id ?? demoAstrologerId
  const astroSlug = astro?.slug ?? 'demo-seed-astrologer'

  for (const [key, user] of [
    ['user:maya', { id: userId, phone: '+919000001101', email: 'maya.preview@example.test', name: 'DEMO Preview Maya', gender: 'female' as const, photoUrl: null, language: 'en' as const, theme: 'light' as const, role: 'user' as const, status: 'active' as const, freeChatUsed: true, createdAt: stamp, updatedAt: stamp, deletedAt: null }],
    ['user:arjun', { id: secondUserId, phone: '+919000001102', email: 'arjun.preview@example.test', name: 'DEMO Preview Arjun', gender: 'male' as const, photoUrl: null, language: 'hi' as const, theme: 'dark' as const, role: 'user' as const, status: 'active' as const, freeChatUsed: false, createdAt: stamp, updatedAt: stamp, deletedAt: null }],
    ['user:astrologer', { id: astroUserId, phone: '+919000001103', email: 'astrologer.preview@example.test', name: 'DEMO Preview Astrologer', gender: 'other' as const, photoUrl: null, language: 'en' as const, theme: 'auto' as const, role: 'astrologer' as const, status: 'active' as const, freeChatUsed: false, createdAt: stamp, updatedAt: stamp, deletedAt: null }],
  ] as const) {
    const didAdd = !exists(db.users, key)
    if (didAdd) db.users.push(user)
    add('users', didAdd)
  }

  if (!db.astrologers.some(a => a.id === demoAstrologerId)) {
    db.astrologers.push({ id: demoAstrologerId, userId: astroUserId, slug: 'demo-seed-astrologer', displayName: 'DEMO Preview Astrologer', bio: 'Fictional pending profile for admin and profile layout preview only.', experienceYears: 6, gender: 'other', languages: ['en', 'hi'], categories: ['career', 'family'], skills: ['vedic', 'numerology'], chatPricePaise: 1800, callPricePaise: 2200, status: 'pending', isOnline: false, isBusy: false, badge: null, isDemo: true, availability: { timezone: 'Asia/Kolkata', weekly: [{ day: 1, start: '10:00', end: '18:00' }, { day: 3, start: '10:00', end: '18:00' }] }, createdAt: stamp, updatedAt: stamp })
    add('astrologers', true)
  } else add('astrologers', false)

  const birth = { name: 'DEMO Sample Birth Profile', gender: 'female' as const, birthDate: '1995-08-14', birthTime: '09:35', birthPlace: 'Jaipur, Rajasthan', latitude: 26.9124, longitude: 75.7873, timezone: 'Asia/Kolkata' }
  if (!exists(db.birthProfiles, 'birth-profile:maya')) db.birthProfiles.push({ id: id('birth-profile:maya'), userId, ...birth, isPrimary: true, createdAt: stamp }), add('birthProfiles', true)
  else add('birthProfiles', false)
  if (!exists(db.savedKundlis, 'saved-kundli:maya')) db.savedKundlis.push({ id: id('saved-kundli:maya'), userId, name: 'DEMO Sample Kundli', birthDate: birth.birthDate, birthTime: birth.birthTime, latitude: birth.latitude!, longitude: birth.longitude!, timezone: birth.timezone, createdAt: stamp }), add('savedKundlis', true)
  else add('savedKundlis', false)

  if (!db.wallets.some(w => w.userId === userId)) db.wallets.push({ userId, balancePaise: 24500, updatedAt: stamp }), add('wallets', true)
  else add('wallets', false)
  if (!db.wallets.some(w => w.userId === secondUserId)) db.wallets.push({ userId: secondUserId, balancePaise: 0, updatedAt: stamp }), add('wallets', true)
  else add('wallets', false)
  const walletRows = [
    { key: 'wallet-tx:maya-credit', type: 'recharge' as const, amountPaise: 50000, balanceAfterPaise: 50000, referenceType: 'payment' as const, referenceId: id('payment:failed'), note: 'DEMO preview balance only; no payment was captured.' },
    { key: 'wallet-tx:maya-debit', type: 'debit' as const, amountPaise: -25500, balanceAfterPaise: 24500, referenceType: 'session' as const, referenceId: sessionId, note: 'DEMO preview consultation history; no real service occurred.' },
  ]
  for (const row of walletRows) {
    const didAdd = !exists(db.walletTxs, row.key)
    if (didAdd) {
      const { key, ...transaction } = row
      db.walletTxs.push({ id: id(key), userId, ...transaction, createdAt: stamp })
    }
    add('walletTxs', didAdd)
  }

  for (const [key, payment] of [
    ['payment:failed', { id: id('payment:failed'), userId, provider: 'mock' as const, providerOrderId: 'DEMO-ORDER-FAILED', providerPaymentId: null, amountPaise: 50000, couponCode: null, bonusPaise: 0, status: 'failed' as const, createdAt: stamp, paidAt: null }],
    ['payment:created', { id: id('payment:created'), userId: secondUserId, provider: 'mock' as const, providerOrderId: 'DEMO-ORDER-PENDING', providerPaymentId: null, amountPaise: 10000, couponCode: 'DEMO10', bonusPaise: 0, status: 'created' as const, createdAt: stamp, paidAt: null }],
  ] as const) {
    const didAdd = !exists(db.payments, key)
    if (didAdd) db.payments.push(payment)
    add('payments', didAdd)
  }
  const coupon = db.coupons.some(c => c.code === 'DEMO10')
  if (!coupon) db.coupons.push({ code: 'DEMO10', type: 'percent', value: 10, minAmountPaise: 10000, maxBonusPaise: 5000, validFrom: new Date(epoch - 86_400_000).toISOString(), validTo: new Date(epoch + 30 * 86_400_000).toISOString(), usageLimit: 100, usedCount: 0, active: true })
  add('coupons', !coupon)

  if (!exists(db.sessions, 'session:ended')) db.sessions.push({ id: sessionId, userId, astrologerId: astroId, type: 'chat', status: 'ended', isFree: false, pricePerMinPaise: 2125, birth, requestedAt: epoch - 3_600_000, startedAt: epoch - 3_500_000, endedAt: epoch - 2_780_000, durationSeconds: 720, billedMinutes: 12, amountChargedPaise: 25500, platformFeePaise: 7650, astrologerEarningPaise: 17850, endReason: 'DEMO preview only', reviewId: id('review:maya'), refundStatus: 'none', refundedPaise: 0 }), add('sessions', true)
  else add('sessions', false)
  if (!exists(db.messages, 'message:user')) db.messages.push({ id: id('message:user'), sessionId, senderRole: 'user', body: '[DEMO] I would like a general career reading.', createdAt: epoch - 3_400_000, readAt: epoch - 3_399_000 }), add('messages', true)
  else add('messages', false)
  if (!exists(db.messages, 'message:astrologer')) db.messages.push({ id: id('message:astrologer'), sessionId, senderRole: 'astrologer', body: '[DEMO] This sample conversation is shown only to preview the chat history layout.', createdAt: epoch - 3_398_000, readAt: epoch - 3_397_000 }), add('messages', true)
  else add('messages', false)
  if (!exists(db.reviews, 'review:maya')) db.reviews.push({ id: id('review:maya'), astrologerId: astroId, userId, rating: 5, comment: 'DEMO sample review for preview only.', astrologerReply: 'DEMO sample reply.', isVisible: true, createdAt: stamp, sessionId }), add('reviews', true)
  else add('reviews', false)
  if (!exists(db.chatReports, 'chat-report:ended')) db.chatReports.push({ id: id('chat-report:ended'), sessionId, reporterId: userId, reporterRole: 'user', reportedUserId: astroId, reportedRole: 'astrologer', reason: 'other', details: '[DEMO] Example report for admin layout preview; no real complaint.', status: 'dismissed', createdAt: stamp, reviewedAt: stamp, reviewerId: 'demo-seed:preview-admin', resolutionNote: 'DEMO preview record.' }), add('chatReports', true)
  else add('chatReports', false)

  if (!exists(db.availabilityWatches, 'availability-watch:maya')) db.availabilityWatches.push({ id: id('availability-watch:maya'), userId, astrologerId: astroId, active: false, createdAt: stamp }), add('availabilityWatches', true)
  else add('availabilityWatches', false)
  if (!exists(db.notifications, 'notification:maya')) db.notifications.push({ id: id('notification:maya'), userId, type: 'support_reply', title: '[DEMO] Support replied', body: 'This sample notification previews the notification list.', href: '/customer-support', readAt: null, createdAt: stamp }), add('notifications', true)
  else add('notifications', false)
  if (!exists(db.webPushSubscriptions, 'push:maya')) db.webPushSubscriptions.push({ id: id('push:maya'), userId, endpoint: 'https://example.invalid/demo-push-endpoint', keys: { p256dh: 'DEMO_ONLY_NOT_A_REAL_PUSH_KEY', auth: 'DEMO_ONLY' }, createdAt: stamp, updatedAt: stamp }), add('webPushSubscriptions', true)
  else add('webPushSubscriptions', false)

  if (!exists(db.supportTickets, 'support:open')) db.supportTickets.push({ id: supportTicketId, userId, category: 'account', subject: '[DEMO] Sample open support request', status: 'open', relatedSessionId: null, createdAt: stamp, updatedAt: stamp }), add('supportTickets', true)
  else add('supportTickets', false)
  if (!exists(db.supportTickets, 'support:resolved')) db.supportTickets.push({ id: id('support:resolved'), userId, category: 'payment', subject: '[DEMO] Sample resolved payment question', status: 'resolved', relatedSessionId: sessionId, createdAt: stamp, updatedAt: stamp }), add('supportTickets', true)
  else add('supportTickets', false)
  if (!exists(db.supportMessages, 'support-message:user')) db.supportMessages.push({ id: id('support-message:user'), ticketId: supportTicketId, senderId: userId, senderRole: 'user', body: '[DEMO] Please show an example of a support conversation.', createdAt: stamp }), add('supportMessages', true)
  else add('supportMessages', false)
  if (!exists(db.supportMessages, 'support-message:admin')) db.supportMessages.push({ id: id('support-message:admin'), ticketId: supportTicketId, senderId: 'demo-seed:preview-admin', senderRole: 'admin', body: '[DEMO] This reply is sample content for preview only.', createdAt: stamp }), add('supportMessages', true)
  else add('supportMessages', false)

  if (!exists(db.auditLogs, 'audit:seed')) db.auditLogs.push({ id: id('audit:seed'), actorId: 'demo-seed:preview-admin', action: 'demo.seed.preview', entity: 'demo', entityId: 'demo-seed', meta: { label: 'DEMO preview only' }, createdAt: stamp }), add('auditLogs', true)
  else add('auditLogs', false)
  if (!exists(db.astrologerPayouts, 'payout:rejected')) db.astrologerPayouts.push({ id: id('payout:rejected'), astrologerId: astroId, amountPaise: 12500, status: 'rejected', requestedAt: stamp, reviewedAt: stamp, paidAt: null, reference: 'DEMO-PREVIEW-ONLY' }), add('astrologerPayouts', true)
  else add('astrologerPayouts', false)

  const otpPhone = '+919000001199'
  if (!exists(db.otps, 'otp:expired')) db.otps.push({ id: id('otp:expired'), phone: otpPhone, codeHash: '0'.repeat(64), expiresAt: epoch - 60_000, attempts: 0, createdAt: epoch - 360_000, consumed: true }), add('otps', true)
  else add('otps', false)
  if (!exists(db.refreshTokens, 'refresh:revoked')) db.refreshTokens.push({ id: id('refresh:revoked'), userId, familyId: id('refresh:family'), tokenHash: '0'.repeat(64), device: 'DEMO preview fixture', ip: '127.0.0.1', createdAt: epoch - 86_400_000, expiresAt: epoch - 1_000, revokedAt: epoch - 1_000 }), add('refreshTokens', true)
  else add('refreshTokens', false)
  const phoneHash = crypto.createHmac('sha256', config.otpSecret).update('free:' + '+919000001101').digest('hex')
  const hasPhoneHash = db.freeChatPhones.includes(phoneHash)
  if (!hasPhoneHash) db.freeChatPhones.push(phoneHash)
  add('freeChatPhones', !hasPhoneHash)

  if (!exists(db.blogPosts, 'blog:draft')) db.blogPosts.push({ id: id('blog:draft'), slug: 'demo-preview-draft', title: '[DEMO] Draft article preview', excerpt: 'A fictional draft used to preview the editor and draft states.', body: 'DEMO preview only.\n\n## Sample heading\n\nThis draft is not published and is not editorial advice.', category: 'Demo', tags: ['demo', 'preview'], authorName: 'Jyotiva Preview', language: 'en', status: 'draft', seoTitle: 'DEMO preview draft', seoDescription: 'Fictional draft content for local UI preview only.', isSample: true, publishedAt: null, createdAt: stamp, updatedAt: stamp }), add('blogPosts', true)
  else add('blogPosts', false)

  save()
  return count
}
