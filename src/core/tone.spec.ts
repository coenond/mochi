import { describe, expect, it } from 'vitest'

import { draftTone, toneOf, type Tone } from './tone'

describe('toneOf', () => {
  const table: [string, Tone][] = [
    // Happy: words, emoji, cheering punctuation.
    ['thanks, that works', 'happy'],
    ['Thank you so much!', 'happy'],
    ['this is awesome', 'happy'],
    ['perfect, ship it', 'happy'],
    ['love it 😍', 'happy'],
    ['🎉🎉', 'happy'],
    ['nice :)', 'happy'],
    ['yay it finally builds!!!', 'happy'],
    ['haha good one', 'happy'],
    ['great job <3', 'happy'],

    // Angry: words, shouting, heated punctuation, emoji.
    ['wtf is this', 'angry'],
    ['this is stupid', 'angry'],
    ['ugh, broken again', 'angry'],
    ['WHY DOES THIS KEEP FAILING', 'angry'],
    ['STOP CHANGING MY FILES', 'angry'],
    ['what did you do?!', 'angry'],
    ['I hate this config', 'angry'],
    ['seriously?!?', 'angry'],
    ['useless 😡', 'angry'],
    ['damn it', 'angry'],

    // Sad: words, trailing dots, emoji.
    ['i give up', 'sad'],
    ['sigh. still broken', 'sad'],
    ["I'm so tired", 'sad'],
    ['nothing works...', 'sad'],
    ['this is hopeless', 'sad'],
    ['😢', 'sad'],
    ['that is sad :(', 'sad'],
    ['feeling exhausted today', 'sad'],
    ['disappointed with this', 'sad'],

    // Neutral: plain asks, code, logs and acronyms.
    ['', 'neutral'],
    ['add a test for the parser', 'neutral'],
    ['rename foo to bar in src/index.ts', 'neutral'],
    ['why does this fail?', 'neutral'],
    ['fix the JSON API in the CSS loader', 'neutral'],
    ['set MAX_RETRIES to 3', 'neutral'],
    ['TODO: tidy this up', 'neutral'],
    ['Error: ENOENT, no such file', 'neutral'],
    ['wait...', 'neutral'],
    ['great but also stupid', 'neutral'],

    // Negation turns a happy word away.
    ['this is not great', 'neutral'],
    ["that doesn't work, not good", 'neutral'],
  ]

  it.each(table)('%j reads as %s', (text, tone) => {
    expect(toneOf(text)).toBe(tone)
  })

  it('reads past the words to what most of them say', () => {
    expect(toneOf('thanks, love it, this is great, sorry for the noise')).toBe('happy')
  })
})

describe('draftTone', () => {
  it('reacts to a draft that turns happy, angry or sad', () => {
    expect(draftTone('neutral', 'thanks!')).toEqual({ tone: 'happy', isNew: true })
  })

  it('does not react again while the draft keeps the same tone', () => {
    expect(draftTone('happy', 'thanks! and also')).toEqual({
      tone: 'happy',
      isNew: false,
    })
  })

  it('reacts when the tone changes', () => {
    expect(draftTone('happy', 'wtf is this')).toEqual({ tone: 'angry', isNew: true })
  })

  it('a neutral draft is nothing new', () => {
    expect(draftTone('angry', 'add a test')).toEqual({ tone: 'neutral', isNew: false })
  })
})
