import { getDb, newId, save, type Astrologer } from '../store.js'
import { slugify } from './data.js'

// Fictional sample profiles for building and testing the marketplace. They are flagged isDemo, shown as
// "Demo" in the UI, have no reviews, no order counts and no ratings, and can be removed with one admin call.
const DEMO: Omit<Astrologer, 'id' | 'userId' | 'slug' | 'createdAt' | 'updatedAt' | 'status' | 'isDemo' | 'isBusy'>[] = [
  { displayName: 'Demo Astrologer A', bio: 'Sample profile for testing. Not a real astrologer. Shows how a Vedic and KP profile with love and marriage focus would look.', experienceYears: 12, gender: 'male', languages: ['en', 'hi'], categories: ['love', 'marriage'], skills: ['vedic', 'kp'], chatPricePaise: 2500, callPricePaise: 3000, isOnline: true, badge: null },
  { displayName: 'Demo Astrologer B', bio: 'Sample profile for testing. Not a real astrologer. Shows a career and finance focused profile.', experienceYears: 8, gender: 'female', languages: ['en', 'hi', 'mr'], categories: ['career', 'finance', 'business'], skills: ['vedic', 'numerology'], chatPricePaise: 1800, callPricePaise: 2200, isOnline: true, badge: null },
  { displayName: 'Demo Astrologer C', bio: 'Sample profile for testing. Not a real astrologer. Shows a Tarot and Prashna profile.', experienceYears: 5, gender: 'female', languages: ['en', 'hi', 'pa'], categories: ['love', 'career'], skills: ['tarot', 'prashna'], chatPricePaise: 1500, callPricePaise: 2000, isOnline: false, badge: null },
  { displayName: 'Demo Astrologer D', bio: 'Sample profile for testing. Not a real astrologer. Shows a Lal Kitab and remedies profile.', experienceYears: 20, gender: 'male', languages: ['hi', 'pa'], categories: ['remedies', 'health', 'family'], skills: ['lal-kitab', 'vedic'], chatPricePaise: 4000, callPricePaise: 5000, isOnline: true, badge: null },
  { displayName: 'Demo Astrologer E', bio: 'Sample profile for testing. Not a real astrologer. Shows a Nadi and education profile.', experienceYears: 15, gender: 'male', languages: ['ta', 'te', 'en'], categories: ['education', 'career'], skills: ['nadi', 'vedic'], chatPricePaise: 3000, callPricePaise: 3500, isOnline: false, badge: null },
  { displayName: 'Demo Astrologer F', bio: 'Sample profile for testing. Not a real astrologer. Shows a Vastu profile.', experienceYears: 10, gender: 'female', languages: ['en', 'hi', 'gu'], categories: ['vastu', 'business'], skills: ['vastu', 'numerology'], chatPricePaise: 2000, callPricePaise: 2500, isOnline: true, badge: null },
]

export function seedDemoAstrologers(): number {
  const db = getDb()
  if (db.astrologers.length > 0) return 0
  const now = new Date().toISOString()
  for (const d of DEMO) db.astrologers.push({ ...d, id: newId(), userId: null, slug: slugify(d.displayName), status: 'approved', isDemo: true, isBusy: false, createdAt: now, updatedAt: now })
  save()
  return DEMO.length
}
