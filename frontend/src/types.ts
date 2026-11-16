export type Language = 'en' | 'hi'
export type ThemeMode = 'light' | 'dark' | 'auto'
export type Gender = 'male' | 'female' | 'other'
export type AdminRole = 'super_admin' | 'support' | 'content' | 'finance'

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
  adminRole?: AdminRole | null
  status?: 'active' | 'suspended'
  freeChatUsed: boolean
  createdAt: string
}

export interface BirthProfile {
  id: string
  name: string
  gender: Gender
  birthDate: string
  birthTime: string | null
  birthPlace: string
  latitude: number | null
  longitude: number | null
  timezone: string
  isPrimary: boolean
  createdAt: string
}
