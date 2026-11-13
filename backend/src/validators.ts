import { z } from 'zod'
import { normalizePhone } from './auth/phone.js'

export const phoneSchema = z.string().trim().transform((s, ctx) => {
  const p = normalizePhone(s)
  if (!p) { ctx.addIssue({ code: 'custom', message: 'Enter a valid 10-digit Indian mobile number' }); return z.NEVER }
  return p
})

export const codeSchema = z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code')

export const sendOtpBody = z.object({ phone: phoneSchema }).strict()
// language/theme are only used when this login creates a brand-new account (keeps a visitor's pre-login choices).
export const verifyOtpBody = z.object({
  phone: phoneSchema,
  code: codeSchema,
  language: z.enum(['en', 'hi']).optional(),
  theme: z.enum(['light', 'dark', 'auto']).optional(),
}).strict()
export const refreshBody = z.object({ refreshToken: z.string().min(20).max(200) }).strict()

const gender = z.enum(['male', 'female', 'other'])

export const patchMeBody = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  gender: gender.nullable(),
  email: z.preprocess(
    v => (typeof v === 'string' && v.trim() === '' ? null : v),
    z.string().trim().toLowerCase().email('Enter a valid email').max(120).nullable(),
  ),
  language: z.enum(['en', 'hi']),
  theme: z.enum(['light', 'dark', 'auto']),
}).partial().strict()

function validDate(s: string): boolean {
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

export const birthDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD')
  .refine(validDate, 'Enter a real date')
  .refine(s => s >= '1900-01-01', 'Date is too far in the past')
  .refine(s => s <= new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10), 'Birth date cannot be in the future')

export const birthTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use the format HH:MM (24-hour)')

export const timezone = z.string().min(1).max(64).refine(tz => {
  try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true } catch { return false }
}, 'Unknown time zone')

const birthFields = {
  name: z.string().trim().min(1, 'Name is required').max(80),
  gender,
  birthDate,
  birthTime: birthTime.nullable(),
  birthPlace: z.string().trim().min(2, 'Enter the birth place').max(120),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  timezone,
  isPrimary: z.boolean(),
}

const coordsTogether = (v: { latitude?: number | null; longitude?: number | null }) =>
  (v.latitude === undefined) === (v.longitude === undefined) && ((v.latitude == null) === (v.longitude == null))

export const createBirthProfileBody = z.object({
  ...birthFields,
  birthTime: birthFields.birthTime.optional().default(null),
  latitude: birthFields.latitude.optional().default(null),
  longitude: birthFields.longitude.optional().default(null),
  timezone: birthFields.timezone.optional().default('Asia/Kolkata'),
  isPrimary: birthFields.isPrimary.optional().default(false),
}).strict().refine(coordsTogether, 'Provide both latitude and longitude, or neither')

export const patchBirthProfileBody = z.object(birthFields).partial().strict()
  .refine(coordsTogether, 'Provide both latitude and longitude, or neither')
