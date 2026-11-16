import { randomInt } from 'node:crypto'
import { SIGNS } from './data.js'

const ELEMENT = ['fire', 'earth', 'air', 'water', 'fire', 'earth', 'air', 'water', 'fire', 'earth', 'air', 'water']
const MODE = ['cardinal', 'fixed', 'mutable', 'cardinal', 'fixed', 'mutable', 'cardinal', 'fixed', 'mutable', 'cardinal', 'fixed', 'mutable']
const elementNotes: Record<string, string> = {
  'fire-fire': 'Shared energy can bring enthusiasm; both people may need room to lead.',
  'earth-earth': 'A practical pace can feel steady; remember to make space for spontaneity.',
  'air-air': 'Conversation and ideas may flow easily; follow-through can help keep plans grounded.',
  'water-water': 'Emotional sensitivity may feel familiar; clear boundaries can prevent crossed signals.',
  'air-fire': 'Ideas and action can encourage each other; pause to check that both feel heard.',
  'earth-water': 'Care and reliability can work well together; say directly what support looks like.',
}
const major = [
  ['The Fool', 'beginning, curiosity, open-mindedness'], ['The Magician', 'resourcefulness, focus, initiative'], ['The High Priestess', 'intuition, patience, inner listening'], ['The Empress', 'care, creativity, abundance'], ['The Emperor', 'structure, responsibility, boundaries'], ['The Hierophant', 'learning, shared values, tradition'], ['The Lovers', 'choice, connection, alignment'], ['The Chariot', 'direction, determination, self-control'], ['Strength', 'courage, compassion, steady effort'], ['The Hermit', 'reflection, solitude, perspective'], ['Wheel of Fortune', 'change, cycles, adaptability'], ['Justice', 'fairness, honesty, accountability'], ['The Hanged One', 'pause, surrender, a new viewpoint'], ['Death', 'closure, transition, renewal'], ['Temperance', 'balance, integration, moderation'], ['The Devil', 'attachments, habits, reclaiming choice'], ['The Tower', 'disruption, truth, rebuilding'], ['The Star', 'hope, restoration, inspiration'], ['The Moon', 'uncertainty, imagination, careful reflection'], ['The Sun', 'clarity, warmth, confidence'], ['Judgement', 'review, awakening, a considered next step'], ['The World', 'completion, integration, wider perspective'],
]
const SUITS = [
  { name: 'Wands', theme: 'energy, initiative and creative effort' },
  { name: 'Cups', theme: 'feelings, relationships and imagination' },
  { name: 'Swords', theme: 'thought, communication and decisions' },
  { name: 'Pentacles', theme: 'resources, routines and practical growth' },
]
const RANKS = [
  ['Ace', 'a fresh opening'], ['Two', 'a choice or partnership'], ['Three', 'early growth and collaboration'], ['Four', 'stability and foundations'], ['Five', 'friction that asks for adjustment'], ['Six', 'support and gradual progress'], ['Seven', 'patience and reassessment'], ['Eight', 'practice and momentum'], ['Nine', 'near-completion and resilience'], ['Ten', 'a cycle reaching its limit'], ['Page', 'curiosity and a beginner’s step'], ['Knight', 'movement and directed effort'], ['Queen', 'mature care and discernment'], ['King', 'responsibility and steady leadership'],
]
const DECK = [
  ...major.map(([name, meaning]) => ({ name, meaning })),
  ...SUITS.flatMap(s => RANKS.map(([rank, cue]) => ({ name: `${rank} of ${s.name}`, meaning: `${cue}, especially around ${s.theme}` }))),
]

export function compatibility(a: string, b: string) {
  const first = SIGNS.findIndex(s => s.toLowerCase() === a.toLowerCase())
  const second = SIGNS.findIndex(s => s.toLowerCase() === b.toLowerCase())
  if (first < 0 || second < 0) throw new Error('Choose two recognized zodiac signs')
  const e1 = ELEMENT[first], e2 = ELEMENT[second]
  const pair = [e1, e2].sort().join('-')
  const harmonious = e1 === e2 || (['fire-air', 'earth-water'].includes(pair))
  const score = first === second ? 78 : harmonious ? 76 : ((MODE[first] === MODE[second]) ? 62 : 68)
  return {
    first: SIGNS[first], second: SIGNS[second], score,
    elements: [e1, e2], modes: [MODE[first], MODE[second]],
    summary: first === second ? 'A same-sign pairing can share familiar rhythms and may benefit from balancing similar blind spots.' : elementNotes[pair] ?? 'Different styles can bring useful perspective; curiosity and direct communication help bridge the gap.',
    method: 'A light editorial exercise based only on broad element and modality associations. It is not a researched compatibility measure or a prediction.',
  }
}

const SPREADS: Record<string, string[]> = {
  single: ['Reflection'], three: ['What to notice', 'What may challenge you', 'A constructive next step'], '3-card': ['What to notice', 'What may challenge you', 'A constructive next step'],
  love: ['Your perspective', 'The relationship dynamic', 'A helpful conversation'],
  career: ['Current focus', 'A resource to use', 'A practical next step'],
  finance: ['Current habits', 'What to review', 'A grounded next step'],
}
export function tarot(spread: string) {
  const positions = SPREADS[spread]
  if (!positions) throw new Error('Choose a supported spread')
  const available = [...DECK]
  return {
    spread, cards: positions.map(position => {
      const card = available.splice(randomInt(available.length), 1)[0]
      return { position, name: card.name, reflection: card.meaning }
    }),
    disclaimer: 'Tarot is offered as a reflective activity for entertainment. It does not predict events or replace professional advice.',
  }
}
