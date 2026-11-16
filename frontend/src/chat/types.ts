export type SessionStatus = 'requested' | 'active' | 'ended' | 'rejected' | 'missed' | 'cancelled'

export interface BirthSnapshot {
  name: string; gender: string; birthDate: string; birthTime: string | null; birthPlace: string
  latitude: number | null; longitude: number | null; timezone: string
}

/** What the API and sockets send for one chat. User and astrologer get different money fields. */
export interface SessionView {
  id: string
  type: 'chat'
  status: SessionStatus
  isFree: boolean
  viewerRole: 'user' | 'astrologer'
  pricePerMinPaise: number
  requestedAt: string
  requestExpiresAt: string
  startedAt: string | null
  endedAt: string | null
  paidUntil: string | null
  durationSeconds: number
  billedMinutes: number
  endReason: string | null
  freeChatSeconds: number
  amountChargedPaise?: number
  refundStatus?: string
  refundedPaise?: number
  astrologerEarningPaise?: number
  reviewed: boolean
  reported: boolean
  astrologer: { slug: string; displayName: string; isDemo: boolean }
  birth: BirthSnapshot
}

export interface ChatMsg {
  id: string
  sessionId?: string
  senderRole: 'user' | 'astrologer' | 'system'
  body: string
  createdAt: string
  read?: boolean
}

export interface ChatStatus {
  freeChatAvailable: boolean
  freeChatMinutes: number
  minBalanceMinutes: number
  balancePaise: number
  openSessionId: string | null
}
