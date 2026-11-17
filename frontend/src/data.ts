export const BRAND = 'Jyotiva'
export const t = (s: string) => s.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
export type Link = { label: string; to: string; key?: string }
const CALCS = ['love-calculator','atmakaraka-and-darakaraka-calculator','name-numerology-calculator','sun-sign-calculator','rising-ascendant-sign-calculator','rashi-moon-sign-calculator','dasha-calculator','nakshatra-birth-star-calculator','mangal-dosha-calculator','shani-sade-sati-calculator']
export const NAV: { key: string; label: string; items: Link[]; wide?: boolean }[] = [
  { key: 'nav.consult', label: 'Consult', items: [{ label: 'Chat with Astrologer', to: '/chat-with-astrologer' }, { label: 'Call with Astrologer', to: '/talk-to-astrologer' }, { label: 'Free Astrology Chat', to: '/free-astrology-chat' }] },
  { key: 'nav.horoscope', label: 'Horoscope', items: ['daily','tomorrow','yesterday','weekly','monthly','yearly'].map(p => ({ label: t(p) + ' Horoscope', to: `/horoscope/${p}-horoscope` })) },
  { key: 'nav.free', label: 'Free Services', items: [{ label: 'Free Kundli', to: '/freekundli' }, { label: 'Kundli Matching', to: '/matchmaking' }, { label: 'Compatibility', to: '/compatibility' }, { label: 'Tarot', to: '/tarot' }] },
  { key: 'nav.calculators', label: 'Calculators', wide: true, items: CALCS.map(s => ({ label: t(s.replace('-calculator', '')), to: '/' + s })) },
  { key: 'nav.panchang', label: 'Panchang', items: [['today-panchang','Today Panchang'],['rahu-kaal','Rahu Kaal'],['choghadiya','Choghadiya'],['tithi','Tithi'],['vaar','Vaar'],['hora','Hora'],['karana','Karana'],['tomorrow-panchang','Tomorrow Panchang']].map(([s, l]) => ({ label: l, to: '/panchang/' + s })).concat([{ label: 'Shubh Muhurat', to: '/shubh-muhurat' }, { label: 'Festivals', to: '/festival' }]) },
]
export const ACCOUNT: Link[] = [{ key: 'acct.profile', label: 'Profile Settings', to: '/profile-settings' }, { key: 'acct.notifications', label: 'Notifications', to: '/notification' }, { key: 'acct.wallet', label: 'Wallet', to: '/my-wallet' }, { key: 'acct.orders', label: 'Order History', to: '/order-history' }, { key: 'acct.support', label: 'Customer Support Chat', to: '/customer-support' }]
export const SIGNS = [['Aries','Mesh','Mar 21 - Apr 19','♈'],['Taurus','Vrishabh','Apr 20 - May 20','♉'],['Gemini','Mithun','May 21 - Jun 20','♊'],['Cancer','Kark','Jun 21 - Jul 22','♋'],['Leo','Singh','Jul 23 - Aug 22','♌'],['Virgo','Kanya','Aug 23 - Sep 22','♍'],['Libra','Tula','Sep 23 - Oct 22','♎'],['Scorpio','Vrishchik','Oct 23 - Nov 21','♏'],['Sagittarius','Dhanu','Nov 22 - Dec 21','♐'],['Capricorn','Makar','Dec 22 - Jan 19','♑'],['Aquarius','Kumbh','Jan 20 - Feb 18','♒'],['Pisces','Meen','Feb 19 - Mar 20','♓']]
export const CATEGORIES = ['Love','Marriage','Career','Business and money','Health and family','KP astrology','Lal Kitab','Nadi','Numerology','Palmistry','Prashna','Tarot','Vaastu']
export const ASTROLOGERS = [
  { name: 'Acharya Devraj', skills: 'Vedic, Prashna', langs: 'Hindi, English', exp: 14, rating: 4.9, price: 28, badge: 'Top choice', online: true },
  { name: 'Meera Iyer', skills: 'Nadi, Numerology', langs: 'Tamil, English', exp: 9, rating: 4.8, price: 35, badge: 'Rising star', online: true },
  { name: 'Pt. Raghav Sharma', skills: 'Vedic, Vastu', langs: 'Hindi, Sanskrit', exp: 21, rating: 5.0, price: 55, badge: 'Top choice', online: false },
  { name: 'Tara Sen', skills: 'Tarot, Life coach', langs: 'Bengali, English', exp: 7, rating: 4.7, price: 30, badge: '', online: true },
]
export const FAQ = [
  ['Is the first chat really free?', 'New users get one free chat of a few minutes. After that you pay per minute from your wallet and can stop any time.'],
  ['Do I need my exact birth time?', 'It helps. Birth time sets your ascendant, so charts without it are less precise. You can still generate a Kundli without it.'],
  ['Is astrology a substitute for professional advice?', 'No. Treat readings as guidance, and speak to a doctor, lawyer or financial adviser for those decisions.'],
]

/** Routes that exist in the menus but are built in later phases. Anything else is a real 404. */
export const PLANNED_ROUTES: Set<string> = new Set([
  ...NAV.flatMap(g => g.items.map(i => i.to)),
  '/astrology-blog', '/astrologer-signup', '/panchang/today-panchang', '/panchang/rahu-kaal', '/panchang/choghadiya',
])
export const isPlannedRoute = (pathname: string): boolean => {
  const p = pathname.replace(/\/+$/, '') || '/'
  return PLANNED_ROUTES.has(p) || /^\/astrology-blog\/[^/]+$/.test(p) || /^\/horoscope\/[a-z-]+-horoscope$/.test(p)
}
