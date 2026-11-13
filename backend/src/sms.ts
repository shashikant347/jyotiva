import { config } from './config.js'
import { HttpError } from './errors.js'

/**
 * SMS delivery. Dev: prints to the console. Production: wire MSG91/Twilio here.
 * Deliberately throws in production until a provider exists, so OTP can never "succeed" silently.
 */
export async function sendSms(phone: string, message: string): Promise<void> {
  if (!config.isProd) {
    console.log(`[dev sms] to ${phone}: ${message}`)
    return
  }
  throw new HttpError(503, 'SMS_NOT_CONFIGURED', 'SMS provider is not configured')
}
