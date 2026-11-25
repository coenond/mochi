// The emote: the short, dim text beside the pet that hints at how it feels (ADR-0004).
// Pure: the spell playing and the time come in. It changes only when the behaviour does,
// at most once every ten seconds, and fades after a few seconds.

import type { Behaviour, Spell } from './idle'

/** About as long as an emote may be. */
export const MAX_EMOTE_LENGTH = 12
/** The least time between one emote and the next. */
export const EMOTE_GAP_MS = 10_000
/** How long an emote shows before it fades. */
export const EMOTE_FADES_MS = 4000

/** What each behaviour says, if anything. Feelings, never requests. */
const EMOTES: Readonly<Record<Behaviour, string | null>> = {
  walk: null,
  sit: null,
  lieDown: null,
  sleep: 'zzz',
  yawn: '*yawn*',
  scratch: '*scratch*',
  spin: null,
  rollOver: null,
  playBow: null,
  hop: null,
  eating: '*nom nom*',
  beingPetted: '<3',
  wagging: '*woof woof*',
  shrinkingBack: '…',
  comingClose: '*nuzzle*',
  curious: '?',
  sniffing: '*sniff*',
  watching: null,
  carrying: null,
  waiting: null,
  worried: '*whine*',
  celebrating: '!!',
  confused: '…?',
}

/** What the pet says during `spell`: a soft `hungry…` by its empty bowl, `<3` for a treat. */
export function emoteOf(spell: Spell): string | null {
  if (spell.isTreat === true) return '<3'
  if (spell.behaviour === 'sit' && spell.isHungry) return 'hungry…'
  return EMOTES[spell.behaviour]
}

/**
 * The emote showing, if any, until when, and what it was last noticed for. `seen` tells
 * one behaviour from the next, so a spell going on says nothing new.
 */
export type EmoteState = {
  text: string | null
  shownAt: number
  fadesAt: number
  seen: string | null
}

export const NO_EMOTE: EmoteState = {
  text: null,
  shownAt: -Infinity,
  fadesAt: -Infinity,
  seen: null,
}

/** The pet's spell at `now`: a new behaviour shows its emote, if the last is long enough ago. */
export function noticeSpell(state: EmoteState, spell: Spell, now: number): EmoteState {
  const seen = seenOf(spell)
  if (seen === state.seen) return state
  const text = emoteOf(spell)
  if (text === null || now - state.shownAt < EMOTE_GAP_MS) return { ...state, seen }
  return { text, shownAt: now, fadesAt: now + EMOTE_FADES_MS, seen }
}

/** The emote showing at `now`, or nothing once it has faded. */
export function emoteAt(state: EmoteState, now: number): string | null {
  return now < state.fadesAt ? state.text : null
}

function seenOf(spell: Spell): string {
  const text = emoteOf(spell)
  return `${spell.behaviour}:${text ?? ''}`
}
