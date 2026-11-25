// Tone: the mood of what the owner writes, read by local heuristics (ADR-0002): words,
// capitals, repeated punctuation and emoji. Free, instant and private; fine to be wrong
// now and then. Pure: text comes in, a tone goes out.

export const TONES = ['happy', 'angry', 'sad', 'neutral'] as const

export type Tone = (typeof TONES)[number]

/** A tone the pet reacts to: anything but neutral. */
export type FeltTone = Exclude<Tone, 'neutral'>

const WORDS: Readonly<Record<FeltTone, readonly string[]>> = {
  happy: [
    'thanks',
    'thank',
    'thx',
    'great',
    'awesome',
    'amazing',
    'love',
    'nice',
    'perfect',
    'yay',
    'cool',
    'excellent',
    'brilliant',
    'works',
    'worked',
    'lol',
    'good',
    'wonderful',
    'fantastic',
    'beautiful',
    'sweet',
    'glad',
    'happy',
  ],
  angry: [
    'wtf',
    'stupid',
    'hate',
    'ugh',
    'terrible',
    'useless',
    'annoying',
    'ffs',
    'seriously',
    'idiot',
    'idiotic',
    'garbage',
    'crap',
    'shit',
    'fuck',
    'fucking',
    'damn',
    'dammit',
    'ridiculous',
    'awful',
    'horrible',
    'furious',
    'angry',
    'pissed',
  ],
  sad: [
    'sad',
    'tired',
    'exhausted',
    'hopeless',
    'sigh',
    'depressed',
    'lonely',
    'disappointed',
    'disappointing',
    'unhappy',
    'miserable',
    'crying',
  ],
}

const PHRASES: Readonly<Record<FeltTone, readonly RegExp[]>> = {
  happy: [/\b(?:ha){2,}h?\b/],
  angry: [/\bwhat the (?:hell|heck)\b/],
  sad: [/\bgive up\b/, /\bnothing works\b/],
}

const EMOJI: Readonly<Record<FeltTone, readonly string[]>> = {
  happy: [
    '😀',
    '😃',
    '😄',
    '😁',
    '😊',
    '🙂',
    '😍',
    '🥰',
    '❤',
    '🎉',
    '👍',
    '🙌',
    '✨',
    ':)',
    ':D',
    '<3',
  ],
  angry: ['😠', '😡', '🤬', '👎', '💢', '>:('],
  sad: ['😢', '😭', '😞', '😔', '☹', '🙁', ':(', ":'("],
}

/** A happy word after one of these is turned away: "not great". */
const NEGATORS = new Set([
  'not',
  'no',
  'never',
  'nothing',
  "isn't",
  "doesn't",
  "don't",
  "didn't",
  "wasn't",
  "aren't",
])

/** Shouting: most words in capitals, at least two of them. Acronyms alone are not it. */
const SHOUT_SHARE = 0.7
const SHOUT_WEIGHT = 2
/** Trailing dots lean sad, but alone they say too little. */
const TRAILING_DOTS_WEIGHT = 0.5

export function toneOf(text: string): Tone {
  const score: Record<FeltTone, number> = { happy: 0, angry: 0, sad: 0 }
  const lower = text.toLowerCase()
  const words = lower.match(/[a-z']+/g) ?? []

  words.forEach((word, i) => {
    for (const felt of ['happy', 'angry', 'sad'] as const) {
      if (!WORDS[felt].includes(word)) continue
      if (felt === 'happy' && NEGATORS.has(words[i - 1] ?? '')) continue
      score[felt] += 1
    }
  })
  for (const felt of ['happy', 'angry', 'sad'] as const) {
    score[felt] += PHRASES[felt].filter(phrase => phrase.test(lower)).length
    score[felt] += EMOJI[felt].reduce((sum, one) => sum + text.split(one).length - 1, 0)
  }

  const plain = text.match(/\b[A-Za-z]{2,}\b/g) ?? []
  const shouted = plain.filter(word => word === word.toUpperCase())
  if (shouted.length >= 2 && shouted.length >= plain.length * SHOUT_SHARE) {
    score.angry += SHOUT_WEIGHT
  }
  if (/\?!|!\?/.test(text)) score.angry += 1
  if (/(?:\.{3,}|…)\s*$/.test(text)) score.sad += TRAILING_DOTS_WEIGHT

  const [first, second] = (['happy', 'angry', 'sad'] as const)
    .map(felt => ({ felt, points: score[felt] }))
    .sort((a, b) => b.points - a.points)
  if (first!.points < 1 || first!.points === second!.points) return 'neutral'
  return first!.felt
}

/**
 * The owner's draft read again after an edit, against the tone the pet last reacted to
 * in it: a tone the pet has not reacted to yet is new.
 */
export function draftTone(
  before: Tone,
  text: string,
): { tone: FeltTone; isNew: true } | { tone: Tone; isNew: false } {
  const tone = toneOf(text)
  return tone !== 'neutral' && tone !== before
    ? { tone, isNew: true }
    : { tone, isNew: false }
}
