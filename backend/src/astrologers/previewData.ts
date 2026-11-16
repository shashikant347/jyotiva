// Extra FICTIONAL sample profiles so the listing page can be checked with a full screen of data.
// Pure data (no imports) so scripts can reuse it. Names are invented; every profile is flagged isDemo.
// ratings are sample values for the preview only and are stored as visible "Sample review" rows.
export interface PreviewAstro {
  displayName: string; bio: string; experienceYears: number; gender: 'male' | 'female'; languages: string[]
  categories: string[]; skills: string[]; chatPricePaise: number; callPricePaise: number; isOnline: boolean; isBusy: boolean
  badge: string | null; ratings: number[]
}
const bio = (t: string) => `Sample profile for testing. Not a real astrologer. ${t}`
export const PREVIEW: PreviewAstro[] = [
  { displayName: 'Demo Aarav', bio: bio('Vedic and KP, career focus.'), experienceYears: 14, gender: 'male', languages: ['en', 'hi'], categories: ['career', 'finance'], skills: ['vedic', 'kp'], chatPricePaise: 2200, callPricePaise: 2600, isOnline: true, isBusy: false, badge: 'Top choice', ratings: [5, 5, 4, 5] },
  { displayName: 'Demo Meera', bio: bio('Love and marriage with tarot.'), experienceYears: 9, gender: 'female', languages: ['en', 'hi', 'gu'], categories: ['love', 'marriage'], skills: ['tarot', 'vedic'], chatPricePaise: 3400, callPricePaise: 3800, isOnline: true, isBusy: false, badge: 'Celebrity', ratings: [5, 5, 5, 4, 5] },
  { displayName: 'Demo Karthik', bio: bio('Nadi astrology and education guidance.'), experienceYears: 22, gender: 'male', languages: ['ta', 'te', 'en'], categories: ['education', 'career'], skills: ['nadi', 'vedic'], chatPricePaise: 1700, callPricePaise: 2100, isOnline: true, isBusy: false, badge: null, ratings: [4, 5, 4] },
  { displayName: 'Demo Sunita', bio: bio('Numerology and family matters.'), experienceYears: 11, gender: 'female', languages: ['hi', 'en'], categories: ['family', 'health'], skills: ['numerology', 'vedic'], chatPricePaise: 2000, callPricePaise: 2400, isOnline: true, isBusy: true, badge: null, ratings: [4, 4, 5] },
  { displayName: 'Demo Rohan', bio: bio('Lal Kitab remedies.'), experienceYears: 18, gender: 'male', languages: ['hi', 'pa'], categories: ['remedies', 'health'], skills: ['lal-kitab', 'palmistry'], chatPricePaise: 4800, callPricePaise: 5200, isOnline: true, isBusy: false, badge: 'Top choice', ratings: [5, 4, 5, 5] },
  { displayName: 'Demo Lakshmi', bio: bio('Vastu and business.'), experienceYears: 16, gender: 'female', languages: ['ml', 'ta', 'en'], categories: ['vastu', 'business'], skills: ['vastu', 'vedic'], chatPricePaise: 1700, callPricePaise: 2000, isOnline: true, isBusy: false, badge: null, ratings: [5, 4] },
  { displayName: 'Demo Imran', bio: bio('Prashna and legal questions.'), experienceYears: 7, gender: 'male', languages: ['ur', 'hi', 'en'], categories: ['legal', 'finance'], skills: ['prashna', 'vedic'], chatPricePaise: 3000, callPricePaise: 3400, isOnline: false, isBusy: false, badge: null, ratings: [4, 4, 3] },
  { displayName: 'Demo Priya', bio: bio('Tarot and love.'), experienceYears: 6, gender: 'female', languages: ['bn', 'en', 'hi'], categories: ['love', 'family'], skills: ['tarot', 'numerology'], chatPricePaise: 2700, callPricePaise: 3100, isOnline: true, isBusy: false, badge: 'Rising star', ratings: [5, 5, 4] },
  { displayName: 'Demo Vikram', bio: bio('KP astrology, business timing.'), experienceYears: 25, gender: 'male', languages: ['mr', 'hi', 'en'], categories: ['business', 'finance', 'career'], skills: ['kp', 'vedic'], chatPricePaise: 5500, callPricePaise: 6000, isOnline: true, isBusy: false, badge: null, ratings: [5, 5, 5, 5, 4] },
]
