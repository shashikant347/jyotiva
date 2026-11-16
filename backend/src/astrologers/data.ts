export const CATEGORY_LIST = [
  { slug: 'love', name: 'Love' }, { slug: 'marriage', name: 'Marriage' }, { slug: 'career', name: 'Career' }, { slug: 'business', name: 'Business' },
  { slug: 'health', name: 'Health' }, { slug: 'finance', name: 'Finance' }, { slug: 'education', name: 'Education' }, { slug: 'legal', name: 'Legal' },
  { slug: 'family', name: 'Family and parents' }, { slug: 'vastu', name: 'Vastu' }, { slug: 'remedies', name: 'Remedies' },
] as const
export const SKILL_LIST = [
  { slug: 'vedic', name: 'Vedic' }, { slug: 'kp', name: 'KP astrology' }, { slug: 'nadi', name: 'Nadi' }, { slug: 'lal-kitab', name: 'Lal Kitab' },
  { slug: 'numerology', name: 'Numerology' }, { slug: 'tarot', name: 'Tarot' }, { slug: 'palmistry', name: 'Palmistry' }, { slug: 'prashna', name: 'Prashna' }, { slug: 'vastu', name: 'Vastu' },
] as const
export const LANGUAGE_LIST = [
  { code: 'en', name: 'English' }, { code: 'hi', name: 'Hindi' }, { code: 'pa', name: 'Punjabi' }, { code: 'bn', name: 'Bengali' }, { code: 'ta', name: 'Tamil' },
  { code: 'te', name: 'Telugu' }, { code: 'kn', name: 'Kannada' }, { code: 'ml', name: 'Malayalam' }, { code: 'mr', name: 'Marathi' }, { code: 'gu', name: 'Gujarati' }, { code: 'ur', name: 'Urdu' },
] as const

export const CATEGORY_SLUGS: string[] = CATEGORY_LIST.map(c => c.slug)
export const SKILL_SLUGS: string[] = SKILL_LIST.map(s => s.slug)
export const LANGUAGE_CODES: string[] = LANGUAGE_LIST.map(l => l.code)

// Admin limits for the price an astrologer may ask, in rupees per minute.
export const MIN_PRICE_RUPEES = 5
export const MAX_PRICE_RUPEES = 200

export const slugify = (s: string): string =>
  s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'astrologer'
