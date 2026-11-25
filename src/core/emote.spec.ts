import { describe, expect, it } from 'vitest'

import {
  EMOTE_FADES_MS,
  EMOTE_GAP_MS,
  emoteAt,
  emoteOf,
  MAX_EMOTE_LENGTH,
  noticeSpell,
  NO_EMOTE,
} from './emote'
import { BEHAVIOURS, type Behaviour, type Spell } from './idle'

function spell(behaviour: Behaviour, extra: Partial<Spell> = {}): Spell {
  return {
    behaviour,
    startedAt: 0,
    fromX: 0,
    toX: 0,
    facing: 'right',
    playMs: 1000,
    holdMs: 0,
    isHungry: false,
    ...extra,
  }
}

describe('emoteOf', () => {
  it.each([
    ['sleep', 'zzz'],
    ['sniffing', '*sniff*'],
    ['curious', '?'],
    ['confused', '…?'],
    ['celebrating', '!!'],
    ['wagging', '*woof woof*'],
    ['beingPetted', '<3'],
  ] as const)('%s shows as %s', (behaviour, text) => {
    expect(emoteOf(spell(behaviour))).toBe(text)
  })

  it('a hungry pet sitting by its empty bowl shows a soft hungry…', () => {
    expect(emoteOf(spell('sit', { isHungry: true }))).toBe('hungry…')
  })

  it('a trick after a treat shows <3', () => {
    expect(emoteOf(spell('spin', { isTreat: true }))).toBe('<3')
  })

  it('walking and sitting about say nothing', () => {
    expect(emoteOf(spell('walk'))).toBeNull()
    expect(emoteOf(spell('sit'))).toBeNull()
  })

  it('is never longer than about twelve characters', () => {
    for (const behaviour of BEHAVIOURS) {
      for (const extra of [{}, { isHungry: true }, { isTreat: true }]) {
        const text = emoteOf(spell(behaviour, extra))
        expect(text?.length ?? 0).toBeLessThanOrEqual(MAX_EMOTE_LENGTH)
      }
    }
  })
})

describe('noticeSpell', () => {
  it('shows the emote when the behaviour changes', () => {
    const state = noticeSpell(NO_EMOTE, spell('sleep'), 0)

    expect(emoteAt(state, 0)).toBe('zzz')
  })

  it('fades after a few seconds', () => {
    const state = noticeSpell(NO_EMOTE, spell('sleep'), 0)

    expect(emoteAt(state, EMOTE_FADES_MS - 1)).toBe('zzz')
    expect(emoteAt(state, EMOTE_FADES_MS)).toBeNull()
  })

  it('the same behaviour going on shows nothing new', () => {
    const shown = noticeSpell(NO_EMOTE, spell('sleep'), 0)
    const later = noticeSpell(shown, spell('sleep', { startedAt: 20_000 }), 20_000)

    expect(emoteAt(later, 20_000)).toBeNull()
  })

  it('changes at most once every ten seconds', () => {
    const first = noticeSpell(NO_EMOTE, spell('sleep'), 0)
    const soon = noticeSpell(first, spell('sniffing'), EMOTE_GAP_MS - 1)

    expect(emoteAt(soon, EMOTE_GAP_MS - 1)).toBeNull()

    const after = noticeSpell(soon, spell('celebrating'), EMOTE_GAP_MS)
    expect(emoteAt(after, EMOTE_GAP_MS)).toBe('!!')
  })

  it('a behaviour with nothing to say does not use up the ten seconds', () => {
    const quiet = noticeSpell(NO_EMOTE, spell('walk'), 0)
    const next = noticeSpell(quiet, spell('sleep'), 1000)

    expect(emoteAt(next, 1000)).toBe('zzz')
  })

  it('a treat trick is a change from the same trick on its own', () => {
    const own = noticeSpell(NO_EMOTE, spell('spin'), 0)
    const treat = noticeSpell(own, spell('spin', { isTreat: true }), 0)

    expect(emoteAt(treat, 0)).toBe('<3')
  })

  it('tells when the emote fades, to redraw then', () => {
    const state = noticeSpell(NO_EMOTE, spell('sleep'), 500)

    expect(state.fadesAt).toBe(500 + EMOTE_FADES_MS)
  })
})
