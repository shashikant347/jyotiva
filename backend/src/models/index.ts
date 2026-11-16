import type { Schema } from 'mongoose'
import type { DB } from '../store.js'
import { UserSchema } from './user.schema.js'
import { BirthProfileSchema } from './birth-profile.schema.js'
import { SavedKundliSchema } from './saved-kundli.schema.js'
import { OtpRequestSchema } from './otp-request.schema.js'
import { RefreshTokenSchema } from './refresh-token.schema.js'
import { HoroscopeSchema } from './horoscope.schema.js'
import { FestivalSchema } from './festival.schema.js'
import { AstrologerSchema } from './astrologer.schema.js'
import { ReviewSchema } from './review.schema.js'
import { SessionSchema } from './session.schema.js'
import { ChatReportSchema } from './chat-report.schema.js'
import { ChatMessageSchema } from './chat-message.schema.js'
import { AvailabilityWatchSchema } from './availability-watch.schema.js'
import { NotificationSchema } from './notification.schema.js'
import { WebPushSubscriptionSchema } from './web-push-subscription.schema.js'
import { WalletSchema } from './wallet.schema.js'
import { WalletTxSchema } from './wallet-tx.schema.js'
import { PaymentSchema } from './payment.schema.js'
import { CouponSchema } from './coupon.schema.js'
import { SupportTicketSchema } from './support-ticket.schema.js'
import { SupportMessageSchema } from './support-message.schema.js'
import { BlogPostSchema } from './blog-post.schema.js'
import { AuditLogSchema } from './audit-log.schema.js'
import { AstrologerPayoutSchema } from './astrologer-payout.schema.js'
import { FreeChatPhoneSchema } from './free-chat-phone.schema.js'

export * from './types.js'
export const modelSchemas = {
  users: UserSchema,
  birthProfiles: BirthProfileSchema,
  savedKundlis: SavedKundliSchema,
  otps: OtpRequestSchema,
  refreshTokens: RefreshTokenSchema,
  horoscopes: HoroscopeSchema,
  festivals: FestivalSchema,
  astrologers: AstrologerSchema,
  reviews: ReviewSchema,
  sessions: SessionSchema,
  chatReports: ChatReportSchema,
  messages: ChatMessageSchema,
  availabilityWatches: AvailabilityWatchSchema,
  notifications: NotificationSchema,
  webPushSubscriptions: WebPushSubscriptionSchema,
  wallets: WalletSchema,
  walletTxs: WalletTxSchema,
  payments: PaymentSchema,
  coupons: CouponSchema,
  supportTickets: SupportTicketSchema,
  supportMessages: SupportMessageSchema,
  blogPosts: BlogPostSchema,
  auditLogs: AuditLogSchema,
  astrologerPayouts: AstrologerPayoutSchema,
  freeChatPhones: FreeChatPhoneSchema,
} satisfies Record<keyof DB, Schema>
