import { getDb, newId, save, type BlogPost } from '../store.js'

// Original sample articles so the blog can be built and tested. Flagged isSample; replace them with your editors' own writing.
type Seed = Pick<BlogPost, 'slug' | 'title' | 'excerpt' | 'body' | 'category' | 'tags' | 'seoDescription'>
const POSTS: Seed[] = [
  {
    slug: 'what-is-a-kundli', title: 'What is a Kundli and what does it show?', category: 'Basics', tags: ['kundli', 'birth chart'],
    excerpt: 'A Kundli is a map of the sky at the moment and place of your birth. Here is what its main parts mean.',
    seoDescription: 'A plain-language guide to the Kundli: what it is, what the houses, signs and planets show, and why birth time matters.',
    body: `A Kundli, also called a birth chart or janam kundli, is a diagram of where the Sun, Moon and planets stood in the sky at the exact time and place you were born. Vedic astrology uses the sidereal zodiac, so the positions differ from the tropical signs used in most Western charts.

## The main parts
The chart is divided into twelve houses. Each house stands for an area of life such as self, family, work or relationships. The sign that rises on the eastern horizon at birth is called the ascendant, or lagna, and it decides which sign sits in which house.

Nine grahas are placed in the chart: Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, Rahu and Ketu. Each one is read by its sign, its house and its relationship with the others.

## Why birth time matters
The ascendant changes about every two hours. A difference of a few minutes can move planets between houses, so an exact birth time gives a more reliable chart.

## A note of caution
Astrology is a tradition of guidance and reflection. It is not a substitute for medical, legal or financial advice, and no chart can promise a particular outcome.`,
  },
  {
    slug: 'reading-your-daily-horoscope', title: 'How to read your daily horoscope sensibly', category: 'Horoscope', tags: ['horoscope', 'daily'],
    excerpt: 'Daily horoscopes are general. A few simple habits help you use them as a prompt for reflection, not a rulebook.',
    seoDescription: 'Practical tips for reading a daily horoscope: sun sign versus moon sign, what ratings mean and how to avoid over-reading.',
    body: `A daily horoscope is written for everyone who shares one sign, which is millions of people. Treat it as a theme for the day rather than a prediction about a specific event.

## Sun sign or Moon sign?
Many Western horoscopes use your Sun sign. In Vedic astrology the Moon sign, called rashi, is usually used for daily reading because the Moon moves quickly and sets the mood of the day. If you know your birth details, you can find your rashi with a free Kundli.

## What the ratings mean
Scores for love, career, health and money are a quick summary of the tone of the text. They are not measurements. A low score is a reason to be a little more careful, not a reason to cancel plans.

## Keep it in proportion
Read the text once, note anything useful, and carry on with your day. Important decisions about health, money or relationships deserve proper professional advice.`,
  },
  {
    slug: 'panchang-basics', title: 'Panchang basics: tithi, nakshatra, yoga and karana', category: 'Panchang', tags: ['panchang', 'tithi'],
    excerpt: 'The Panchang has five parts. This short guide explains each one in simple words.',
    seoDescription: 'An easy introduction to the five parts of the Hindu Panchang: tithi, vaar, nakshatra, yoga and karana.',
    body: `Panchang means five limbs. The Hindu almanac lists five elements for every day, and together they are used to choose auspicious times for ceremonies and daily tasks.

## The five parts
Tithi is the lunar day. It is based on the angle between the Sun and the Moon, and there are thirty in a lunar month. Vaar is the weekday. Nakshatra is the star group the Moon is passing through, out of twenty-seven. Yoga is a measure combining the positions of the Sun and Moon. Karana is half of a tithi.

## Times that depend on your city
Sunrise and sunset differ from place to place, so periods such as Rahu Kaal and Abhijit Muhurat are calculated for your location. Always check the Panchang for your own city.

## Using it well
Many families look at the Panchang before weddings, house entry or travel. Customs differ between regions and traditions, so ask a trusted priest or elder if you are unsure.`,
  },
]

export function seedSampleBlog(): number {
  const db = getDb()
  if (db.blogPosts.length > 0) return 0
  const base = Date.now()
  POSTS.forEach((p, i) => {
    const at = new Date(base - i * 86_400_000).toISOString()
    db.blogPosts.push({ id: newId(), ...p, authorName: 'Jyotiva Editorial', language: 'en', status: 'published', seoTitle: p.title, isSample: true, publishedAt: at, createdAt: at, updatedAt: at })
  })
  save()
  return POSTS.length
}
