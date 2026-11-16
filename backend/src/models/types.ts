export type Gender = 'male' | 'female' | 'other'

export type Language = 'en' | 'hi'

export type ThemeMode = 'light' | 'dark' | 'auto'

export type AdminRole = 'super_admin' | 'support' | 'content' | 'finance'

export type UserStatus = 'active' | 'suspended'

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
  adminRole?: AdminRole
  status?: UserStatus
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

export interface SavedKundli {
  id: string
  userId: string
  name: string
  birthDate: string
  birthTime: string | null
  latitude: number
  longitude: number
  timezone: string
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

export type HoroscopePeriod = 'daily' | 'weekly' | 'monthly' | 'yearly'

export type HoroscopeCategory = 'general' | 'love' | 'career' | 'finance' | 'health'

export interface Horoscope {
  id: string
  sign: number // 0 = Aries ... 11 = Pisces
  period: HoroscopePeriod
  category: HoroscopeCategory
  language: Language
  dateFrom: string // YYYY-MM-DD
  dateTo: string
  text: string
  luckyNumber: number | null
  luckyColor: string | null
  mood: string | null
  loveScore: number | null
  careerScore: number | null
  healthScore: number | null
  moneyScore: number | null
  status: 'draft' | 'scheduled' | 'published'
  isSample?: boolean
  createdAt: string
  updatedAt: string
}

export interface Festival {
  id: string
  slug: string
  title: string
  date: string
  region: string
  language: Language
  tithi: string
  paksha: string
  description: string
  status: 'draft' | 'published'
  isSample?: boolean
  createdAt: string
  updatedAt: string
}

export interface Astrologer {
  id: string
  userId: string | null // null for demo profiles
  slug: string
  displayName: string
  bio: string
  experienceYears: number
  gender: Gender
  photoUrl?: string | null
  languages: string[]
  categories: string[]
  skills: string[]
  chatPricePaise: number // per minute, integer paise
  callPricePaise: number
  status: 'pending' | 'approved' | 'rejected' | 'suspended'
  isOnline: boolean
  isBusy: boolean
  badge: string | null
  isDemo: boolean
  availability?: { timezone: string; weekly: { day: number; start: string; end: string }[] } | null
  createdAt: string
  updatedAt: string
}

export interface Review {
  id: string
  astrologerId: string
  userId: string
  rating: number // 1-5
  comment: string
  astrologerReply: string | null
  isVisible: boolean
  createdAt: string
  sessionId?: string // set for reviews written after a chat session
}

export interface BirthSnapshot { name: string; gender: Gender; birthDate: string; birthTime: string | null; birthPlace: string; latitude: number | null; longitude: number | null; timezone: string }

export interface Session {
  id: string
  userId: string
  astrologerId: string
  type: 'chat'
  status: 'requested' | 'active' | 'ended' | 'rejected' | 'missed' | 'cancelled'
  isFree: boolean
  pricePerMinPaise: number
  birth: BirthSnapshot
  requestedAt: number
  startedAt: number | null
  endedAt: number | null
  durationSeconds: number
  billedMinutes: number
  amountChargedPaise: number
  platformFeePaise: number
  astrologerEarningPaise: number
  endReason: string | null
  reviewId: string | null
  refundStatus: 'none' | 'flagged' | 'refunded' | 'declined'
  refundedPaise: number
}

export type ChatReportReason = 'harassment' | 'abuse' | 'spam' | 'inappropriate' | 'other'

export interface ChatReport {
  id: string
  sessionId: string
  reporterId: string
  reporterRole: 'user' | 'astrologer'
  reportedUserId: string
  reportedRole: 'user' | 'astrologer'
  reason: ChatReportReason
  details: string
  status: 'open' | 'actioned' | 'dismissed'
  createdAt: string
  reviewedAt: string | null
  reviewerId: string | null
  resolutionNote: string | null
}

export interface ChatMessage { id: string; sessionId: string; senderRole: 'user' | 'astrologer' | 'system'; body: string; createdAt: number; readAt: number | null }

export interface AvailabilityWatch { id: string; userId: string; astrologerId: string; active: boolean; createdAt: string }

export interface Notification { id: string; userId: string; type: 'astrologer_available' | 'support_reply'; title: string; body: string; href: string; readAt: string | null; createdAt: string }

export interface WebPushSubscription { id: string; userId: string; endpoint: string; keys: { p256dh: string; auth: string }; createdAt: string; updatedAt: string }

export interface Wallet { userId: string; balancePaise: number; updatedAt: string }

export interface WalletTx {
  id: string
  userId: string
  type: 'recharge' | 'bonus' | 'debit' | 'refund' | 'adjustment'
  amountPaise: number // signed: credits positive, debits negative
  balanceAfterPaise: number
  referenceType: 'payment' | 'session' | 'admin'
  referenceId: string
  note: string
  createdAt: string
}

export interface Payment {
  id: string
  userId: string
  provider: 'razorpay' | 'mock'
  providerOrderId: string
  providerPaymentId: string | null
  amountPaise: number
  couponCode: string | null
  bonusPaise: number
  status: 'created' | 'paid' | 'failed'
  createdAt: string
  paidAt: string | null
}

export interface Coupon {
  code: string
  type: 'percent' | 'flat'
  value: number // percent (1-100) or paise
  minAmountPaise: number
  maxBonusPaise: number // cap for percent coupons
  validFrom: string // ISO
  validTo: string // ISO
  usageLimit: number // total uses allowed
  usedCount: number
  active: boolean
}

export type TicketCategory = 'payment' | 'chat' | 'astrologer' | 'account' | 'other'

export interface SupportTicket {
  id: string
  userId: string
  category: TicketCategory
  subject: string
  status: 'open' | 'pending' | 'resolved' // open = waiting for us, pending = waiting for the user
  relatedSessionId: string | null
  createdAt: string
  updatedAt: string
}

export interface SupportMessage { id: string; ticketId: string; senderId: string; senderRole: 'user' | 'admin'; body: string; createdAt: string }

export interface BlogPost {
  id: string
  slug: string
  coverImageUrl?: string | null
  title: string
  excerpt: string
  body: string // plain text; a blank line starts a new paragraph, a line starting with "## " is a heading
  category: string
  tags: string[]
  authorName: string
  language: Language
  status: 'draft' | 'published'
  seoTitle: string
  seoDescription: string
  isSample: boolean
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface AuditLog { id: string; actorId: string; action: string; entity: string; entityId: string; meta: unknown; createdAt: string }

export interface AstrologerPayout {
  id: string
  astrologerId: string
  amountPaise: number
  status: 'requested' | 'approved' | 'rejected' | 'paid'
  requestedAt: string
  reviewedAt: string | null
  paidAt: string | null
  reference: string | null
}
