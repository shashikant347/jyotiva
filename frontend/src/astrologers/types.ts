export interface Astro {
  slug: string; displayName: string; bio: string; experienceYears: number; gender: 'male' | 'female' | 'other'
  photoUrl?: string | null
  languages: string[]; categories: string[]; skills: string[]; chatPricePaise: number; callPricePaise: number
  status: 'online' | 'busy' | 'offline'; badge: string | null; isDemo: boolean; ratingAvg: number | null; ratingCount: number
  availability?: { timezone: string; weekly: { day: number; start: string; end: string }[] } | null
}
export interface Meta {
  categories: { slug: string; name: string }[]; skills: { slug: string; name: string }[]; languages: { code: string; name: string }[]
  priceLimits: { minRupees: number; maxRupees: number }
}
export const rupees = (paise: number): string => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
