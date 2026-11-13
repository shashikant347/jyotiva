export const SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'] as const
export const SIGN_LORDS = ['Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter'] as const

export const NAKSHATRAS = [
  'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra', 'Punarvasu', 'Pushya', 'Ashlesha',
  'Magha', 'Purva Phalguni', 'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha',
  'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha', 'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati',
] as const

// Vimshottari order and years. Nakshatra i is ruled by DASHA_ORDER[i % 9].
export const DASHA_ORDER = ['Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury'] as const
export const DASHA_YEARS: Record<string, number> = { Ketu: 7, Venus: 20, Sun: 6, Moon: 10, Mars: 7, Rahu: 18, Jupiter: 16, Saturn: 19, Mercury: 17 }

export type Gana = 'Deva' | 'Manushya' | 'Rakshasa'
export const GANA: Gana[] = [
  'Deva', 'Manushya', 'Rakshasa', 'Manushya', 'Deva', 'Manushya', 'Deva', 'Deva', 'Rakshasa',
  'Rakshasa', 'Manushya', 'Manushya', 'Deva', 'Rakshasa', 'Deva', 'Rakshasa', 'Deva', 'Rakshasa',
  'Rakshasa', 'Manushya', 'Manushya', 'Deva', 'Rakshasa', 'Rakshasa', 'Manushya', 'Manushya', 'Deva',
]

export type Nadi = 'Adi' | 'Madhya' | 'Antya'
export const NADI: Nadi[] = [
  'Adi', 'Madhya', 'Antya', 'Antya', 'Madhya', 'Adi', 'Adi', 'Madhya', 'Antya',
  'Antya', 'Madhya', 'Adi', 'Adi', 'Madhya', 'Antya', 'Antya', 'Madhya', 'Adi',
  'Adi', 'Madhya', 'Antya', 'Antya', 'Madhya', 'Adi', 'Adi', 'Madhya', 'Antya',
]

// Varna by Moon sign. Rank: higher is higher caste group (Brahmin 4 ... Shudra 1).
export const VARNA_NAME = ['Kshatriya', 'Vaishya', 'Shudra', 'Brahmin', 'Kshatriya', 'Vaishya', 'Shudra', 'Brahmin', 'Kshatriya', 'Vaishya', 'Shudra', 'Brahmin'] as const
export const VARNA_RANK: Record<string, number> = { Brahmin: 4, Kshatriya: 3, Vaishya: 2, Shudra: 1 }

// Yoni animal by nakshatra (used for display; scoring is not enabled, see matching.ts).
export const YONI = [
  'Horse', 'Elephant', 'Goat', 'Serpent', 'Serpent', 'Dog', 'Cat', 'Goat', 'Cat',
  'Rat', 'Rat', 'Cow', 'Buffalo', 'Tiger', 'Buffalo', 'Tiger', 'Deer', 'Deer',
  'Dog', 'Monkey', 'Mongoose', 'Monkey', 'Lion', 'Horse', 'Lion', 'Cow', 'Elephant',
]

// Natural planetary friendship (Parashara). F = friend, N = neutral, E = enemy.
type Rel = 'F' | 'N' | 'E'
export const FRIENDSHIP: Record<string, Record<string, Rel>> = {
  Sun:     { Moon: 'F', Mars: 'F', Mercury: 'N', Jupiter: 'F', Venus: 'E', Saturn: 'E' },
  Moon:    { Sun: 'F', Mars: 'N', Mercury: 'F', Jupiter: 'N', Venus: 'N', Saturn: 'N' },
  Mars:    { Sun: 'F', Moon: 'F', Mercury: 'E', Jupiter: 'F', Venus: 'N', Saturn: 'N' },
  Mercury: { Sun: 'F', Moon: 'E', Mars: 'N', Jupiter: 'N', Venus: 'F', Saturn: 'N' },
  Jupiter: { Sun: 'F', Moon: 'F', Mars: 'F', Mercury: 'E', Venus: 'E', Saturn: 'N' },
  Venus:   { Sun: 'E', Moon: 'E', Mars: 'N', Mercury: 'F', Jupiter: 'N', Saturn: 'F' },
  Saturn:  { Sun: 'E', Moon: 'E', Mars: 'E', Mercury: 'F', Jupiter: 'N', Venus: 'F' },
}
