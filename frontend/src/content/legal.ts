export interface StaticDoc {
  title: string
  summary: string
  updated: string
  sections: { h: string; p: string[] }[]
}

// DRAFT copy written for this project. Replace the [bracketed] details and have a
// lawyer review every page before launch.
export const COMPANY = {
  name: '[Company legal name]',
  address: '[Registered office address]',
  email: '[support email]',
  grievance: '[Grievance officer name and email]',
}

export const STATIC_DOCS: Record<string, StaticDoc> = {
  'about-us': {
    title: 'About us',
    summary: 'Who we are and what we offer.',
    updated: '13 November 2026',
    sections: [
      { h: 'What we do', p: ['Jyotiva brings Vedic astrology tools and independent astrologers to one place. You can generate a free Kundli, match two charts, read horoscopes and the daily Panchang, and talk to an astrologer by chat or call.'] },
      { h: 'How we work', p: ['Astrologers on the platform are independent practitioners. We check their identity and experience before they are listed, and we show their ratings and reviews from real consultations.', 'Astrology is offered for guidance and reflection. It is not a substitute for medical, legal or financial advice.'] },
      { h: 'Contact', p: ['Write to us at the support address in the footer or use Customer Support Chat after you sign in.'] },
    ],
  },
  'terms-and-conditions': {
    title: 'Terms and conditions',
    summary: 'The rules for using the website and its services.',
    updated: '13 November 2026',
    sections: [
      { h: 'Acceptance', p: ['By creating an account or using the service you agree to these terms. If you do not agree, please do not use the service.'] },
      { h: 'Eligibility', p: ['You must be 18 or older to create an account, add money to the wallet or consult an astrologer.'] },
      { h: 'Your account', p: ['You sign in with your mobile number and a one-time code. Keep your phone secure and do not share the code. You are responsible for activity under your account.'] },
      { h: 'Consultations and wallet', p: ['Chat and call consultations are charged per minute at the rate shown on the astrologer profile. The amount is deducted from your wallet balance. New users may receive one free introductory chat; this offer can change.', 'Wallet money is used only for consultations on the platform. Refunds follow the Refund and cancellation policy.'] },
      { h: 'Acceptable use', p: ['Do not misuse the service, harass astrologers or other users, share unlawful content, try to bypass payments, or attempt to access other people\'s data. We may suspend accounts that break these rules.'] },
      { h: 'Nature of astrology', p: ['Readings are the opinion of the astrologer, given for guidance. We do not guarantee any outcome. Please read the Disclaimer.'] },
      { h: 'Limit of liability', p: ['To the extent the law allows, we are not liable for decisions you make based on a reading or for losses that were not reasonably foreseeable.'] },
      { h: 'Changes and governing law', p: ['We may update these terms and will post the new date here. These terms are governed by the laws of India. [Add jurisdiction and dispute-resolution details.]'] },
    ],
  },
  'privacy-policies': {
    title: 'Privacy policy',
    summary: 'What data we collect, why, and the choices you have.',
    updated: '13 November 2026',
    sections: [
      { h: 'What we collect', p: ['Your mobile number, and optionally your name, gender and email. Birth details you save (name, date, time and place of birth). Theme and language preferences. Technical data such as device type and IP address, used for security and rate limiting.'] },
      { h: 'Why we use it', p: ['To sign you in, to generate charts and readings, to let astrologers prepare for a consultation you start, to process payments, to prevent abuse, and to improve the service.'] },
      { h: 'Who sees it', p: ['Birth details are shared with an astrologer only when you start a consultation with them. We use service providers for SMS, payments and hosting under contract. We do not sell your personal data.'] },
      { h: 'Your choices', p: ['You can edit or delete saved birth profiles at any time. From Profile Settings you can download a copy of your data and delete your account. Deleting your account removes your birth profiles and sessions and frees your mobile number. Some records, such as payment records, may be kept where the law requires it.'] },
      { h: 'Security', p: ['One-time codes are stored only in hashed form and expire in five minutes. Sessions use short-lived tokens. No system is perfectly secure, so please tell us if you notice anything unusual.'] },
      { h: 'Retention', p: ['We keep account data while your account is active and delete it after you close the account, except where a longer period is required by law. [Add exact periods.]'] },
      { h: 'Grievances', p: ['For questions or complaints about your data, contact the grievance officer: ' + COMPANY.grievance + '.'] },
    ],
  },
  'refund-and-cancellation-policy': {
    title: 'Refund and cancellation policy',
    summary: 'When money can be returned and how to ask.',
    updated: '13 November 2026',
    sections: [
      { h: 'Wallet recharge', p: ['Money added to the wallet is meant for consultations. Unused balance can be refunded to the original payment method on request. [Confirm timelines and any fees.]'] },
      { h: 'Consultations', p: ['You are charged only for the minutes used. If a chat or call fails to connect, or drops because of a technical fault on our side, the unused or affected minutes are credited back to your wallet.', 'If an astrologer does not respond after you start a session, the session ends automatically and you are not charged.'] },
      { h: 'Complaints about a reading', p: ['Astrology is opinion-based, so a reading you disagree with is not a ground for a refund. If an astrologer behaved inappropriately or you were charged wrongly, contact Customer Support within 7 days and we will review it.'] },
      { h: 'How to ask', p: ['Open Customer Support Chat from your account menu with the date and astrologer name. We aim to reply within 2 working days.'] },
    ],
  },
  disclaimer: {
    title: 'Disclaimer',
    summary: 'What astrology can and cannot do.',
    updated: '13 November 2026',
    sections: [
      { h: 'For guidance only', p: ['Horoscopes, Kundli reports, calculators and consultations are provided for guidance, reflection and entertainment. They are based on traditional methods and the personal views of astrologers.'] },
      { h: 'Not professional advice', p: ['Nothing here is medical, legal, financial or psychological advice. Please consult a qualified professional for those decisions, and do not stop or change treatment because of a reading.'] },
      { h: 'No guarantees', p: ['We and the astrologers do not promise any result. Calculations depend on the birth details you enter, so small errors in time or place can change a chart.'] },
      { h: 'Remedies', p: ['Suggested remedies are optional. Please do not spend money you cannot afford on any remedy.'] },
    ],
  },
}
