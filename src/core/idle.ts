// Idle life: which idle behaviour the pet chooses on its own, where it walks in the band,
// and which frame shows when. Pure: time, the band's room, the pet's mood and a random
// source come in. Reactions play as spells of their own, cutting short what ranks below
// them (ADR-0005): care (eating, being petted) above all, then reactions to trouble, wins
// and confusion, then the owner's tone, then curiosity while the owner types, then
// thinking while Claude works, then idle life.
//
// Now and then idle life plays a trick of its own; a trick after a treat is care.
//
// The pet lives one spell after another. A spell plays its behaviour's frames, then
// holds one still pose with no redraw at all. Holding lasts about four times as long as
// playing, so the pet moves about a fifth of the time.

import { PET_FRAMES } from './sheet'
import type { FeltTone } from './tone'

export const IDLE_BEHAVIOURS = [
  'walk',
  'sit',
  'lieDown',
  'sleep',
  'yawn',
  'scratch',
] as const

export type IdleBehaviour = (typeof IDLE_BEHAVIOURS)[number]

/** Short, playful behaviours: done now and then on their own, and always after a treat. */
export const TRICKS = ['spin', 'rollOver', 'playBow', 'hop'] as const

export type Trick = (typeof TRICKS)[number]

/** The reactions to the owner's care, which come before anything else (ADR-0005). */
export const CARE = ['eating', 'beingPetted'] as const

export type Care = (typeof CARE)[number]

/** Thinking while Claude works, flavoured by the tool in use. */
export const THINKING = ['sniffing', 'watching', 'carrying', 'waiting'] as const

export type Thinking = (typeof THINKING)[number]

/** What Claude is doing in the turn, and since when. */
export type Work = { thinking: Thinking; since: number }

/** The reactions to how Claude's work goes: trouble, a win, the owner refusing. */
export const WORK_REACTIONS = ['worried', 'celebrating', 'confused'] as const

export type WorkReaction = (typeof WORK_REACTIONS)[number]

/** The reactions to the owner's tone: happy wags, angry shrinks back, sad comes close. */
export const TONE_REACTIONS = ['wagging', 'shrinkingBack', 'comingClose'] as const

export type ToneReaction = (typeof TONE_REACTIONS)[number]

export const BEHAVIOURS = [
  ...IDLE_BEHAVIOURS,
  ...TRICKS,
  ...CARE,
  ...TONE_REACTIONS,
  'curious',
  ...THINKING,
  ...WORK_REACTIONS,
] as const

/** The idle behaviours, the tricks, and the reactions built so far. */
export type Behaviour = (typeof BEHAVIOURS)[number]

/** How the pet's needs colour its idle life. */
export type Mood = { isHungry: boolean; isTired: boolean }

export const CALM: Mood = { isHungry: false, isTired: false }

export type Facing = 'left' | 'right'

/** Numbers from 0 up to 1, as `Math.random` gives them. */
export type Random = () => number

/** One stretch of a behaviour: played from `startedAt` for `playMs`, then held. */
export type Spell = {
  behaviour: Behaviour
  startedAt: number
  /** Columns from the band's left edge, where the spell starts and ends. */
  fromX: number
  toX: number
  facing: Facing
  playMs: number
  holdMs: number
  /** A hungry pet walks slower and sits by its empty bowl. */
  isHungry: boolean
  /** Tone only: a hungry or tired pet plays its frames slower. */
  isWeary?: boolean
  /** A trick after a treat, which ranks as care (ADR-0005). */
  isTreat?: boolean
  /** Curiosity only: when a `?` made it tilt its head, ears up. */
  perkedAt?: number | null
}

/** What the band draws at one moment, and when it next needs drawing. */
export type Pose = {
  behaviour: Behaviour
  frame: number
  x: number
  facing: Facing
  hasEmptyBowl: boolean
  isMoving: boolean
  nextAt: number
}

/** The shortest walk worth taking, in columns. */
export const MIN_WALK_COLUMNS = 4

/** About 6 frames a second at most (spec: 6 to 9 while moving). */
const MIN_FRAME_MS = 160
/** How long the pet keeps watching the prompt after the owner's last key. */
export const WANDER_AFTER_MS = 10_000
/** Watching Claude this long becomes a long wait: the pet lies down. */
export const LONG_WAIT_MS = 30_000
/** Lying down waiting this long, the pet dozes off. */
export const DOZE_AFTER_MS = 120_000
/** How long a patient wait holds before it is looked at again. */
const WAIT_HOLD_MS = 10 * 60_000
/** How far the pet sniffs or carries something about, at most. */
const MAX_WORK_WALK = 16
/** How long a reaction to trouble, a win or confusion lasts. */
export const REACTION_MS = 5000
/** Each more trouble in the same turn keeps the pet worried this much longer, up to a cap. */
const MORE_WORRY_MS = 2500
const MAX_WORRY_MS = 3 * REACTION_MS
/** A hungry pet walks at about 4 frames a second. */
const HUNGRY_WALK_FRAME_MS = 240
/** A hungry or tired pet reacts to tone this much slower. */
const WEARY_SLOWDOWN = 1.5
const STILL_PER_MOVING = 4
/** Holds vary from 75% to 125% of their share, so the pet does not tick like a clock. */
const HOLD_JITTER = 0.5

/** How long each frame shows, and how many times the frames play before the hold. */
const PLAY: Readonly<Record<Behaviour, { frameMs: number; passes: number }>> = {
  walk: { frameMs: MIN_FRAME_MS, passes: 1 },
  sit: { frameMs: 600, passes: 1 },
  lieDown: { frameMs: 700, passes: 1 },
  sleep: { frameMs: 1100, passes: 3 },
  yawn: { frameMs: 380, passes: 1 },
  scratch: { frameMs: MIN_FRAME_MS, passes: 5 },
  spin: { frameMs: MIN_FRAME_MS, passes: 2 },
  rollOver: { frameMs: 200, passes: 2 },
  playBow: { frameMs: 200, passes: 2 },
  hop: { frameMs: MIN_FRAME_MS, passes: 2 },
  eating: { frameMs: 220, passes: 2 },
  beingPetted: { frameMs: 220, passes: 2 },
  wagging: { frameMs: 220, passes: 4 },
  shrinkingBack: { frameMs: MIN_FRAME_MS, passes: 1 },
  comingClose: { frameMs: MIN_FRAME_MS, passes: 1 },
  curious: { frameMs: 500, passes: 1 },
  sniffing: { frameMs: 200, passes: 1 },
  watching: { frameMs: 700, passes: 1 },
  carrying: { frameMs: MIN_FRAME_MS, passes: 1 },
  waiting: { frameMs: 900, passes: 1 },
  worried: { frameMs: 600, passes: 2 },
  celebrating: { frameMs: 120, passes: 4 },
  confused: { frameMs: 650, passes: 1 },
}

/** The behaviour whose first frame is held after playing. */
const HOLD_AS: Readonly<Record<Behaviour, Behaviour>> = {
  walk: 'walk',
  sit: 'sit',
  lieDown: 'lieDown',
  sleep: 'sleep',
  yawn: 'sit',
  scratch: 'sit',
  spin: 'sit',
  rollOver: 'sit',
  playBow: 'sit',
  hop: 'sit',
  eating: 'sit',
  beingPetted: 'sit',
  wagging: 'sit',
  shrinkingBack: 'shrinkingBack',
  comingClose: 'lieDown',
  curious: 'curious',
  sniffing: 'sniffing',
  watching: 'watching',
  carrying: 'carrying',
  waiting: 'waiting',
  worried: 'worried',
  celebrating: 'celebrating',
  confused: 'confused',
}

/** How often each is chosen, against the others. */
const WEIGHTS: Readonly<Record<IdleBehaviour | Trick, number>> = {
  walk: 3,
  sit: 3,
  lieDown: 2,
  sleep: 1,
  yawn: 1,
  scratch: 1,
  spin: 0.2,
  rollOver: 0.15,
  playBow: 0.2,
  hop: 0.2,
}
const HUNGRY_SITS = 3
const TIRED_SLEEPS = 4

/**
 * The spell after `previous`, starting at `now`. `room` is how many columns the pet can
 * move in: the band's width less the pet's own.
 */
export function nextSpell(
  previous: Spell | null,
  now: number,
  room: number,
  random: Random,
  mood: Mood = CALM,
): Spell {
  const maxX = Math.max(0, room)
  const x = Math.min(previous?.toX ?? 0, maxX)
  const facing = previous?.facing ?? 'right'
  const canWalk = previous?.behaviour !== 'walk' && maxX >= MIN_WALK_COLUMNS
  const behaviour = choose(random, canWalk, mood)
  const { isHungry } = mood

  if (behaviour === 'walk') {
    const toX = walkTarget(x, maxX, random)
    return {
      behaviour,
      startedAt: now,
      fromX: x,
      toX,
      facing: toX > x ? 'right' : 'left',
      playMs: Math.abs(toX - x) * frameMsOf('walk', isHungry),
      holdMs: 0,
      isHungry,
    }
  }

  const { passes } = PLAY[behaviour]
  const playMs = frameMsOf(behaviour, isHungry) * PET_FRAMES[behaviour].length * passes
  // A walk holds nothing, so the rest after it holds still for both.
  const owed = previous?.behaviour === 'walk' ? previous.playMs : 0
  const jitter = 1 - HOLD_JITTER / 2 + random() * HOLD_JITTER
  const holdMs = Math.round((playMs + owed) * STILL_PER_MOVING * jitter)

  return { behaviour, startedAt: now, fromX: x, toX: x, facing, playMs, holdMs, isHungry }
}

/**
 * The owner fed or petted the pet: it reacts where it is now, cutting short whatever it
 * was doing, and holds nothing after, so idle life picks up again once it is done.
 */
export function careSpell(behaviour: Care, previous: Spell | null, now: number): Spell {
  return playedHere(behaviour, previous, now)
}

/** `behaviour` played once through where the pet is now, holding nothing after. */
function playedHere(behaviour: Behaviour, previous: Spell | null, now: number): Spell {
  const pose = previous === null ? null : poseAt(previous, now)
  const x = pose?.x ?? 0
  const { frameMs, passes } = PLAY[behaviour]
  return {
    behaviour,
    startedAt: now,
    fromX: x,
    toX: x,
    facing: pose?.facing ?? 'right',
    playMs: frameMs * PET_FRAMES[behaviour].length * passes,
    holdMs: 0,
    isHungry: false,
  }
}

/**
 * The owner gave a treat: the pet does a trick where it is, any of them, cutting short
 * whatever it was doing. It ranks as care (ADR-0005) and holds nothing after.
 */
export function treatSpell(previous: Spell | null, now: number, random: Random): Spell {
  const trick = TRICKS[Math.min(TRICKS.length - 1, Math.floor(random() * TRICKS.length))]!
  return { ...playedHere(trick, previous, now), isTreat: true }
}

/**
 * Claude's work went wrong, came right after trouble, or the owner refused it: the pet
 * reacts where it is for about five seconds, moving a while and then holding still.
 * `troubleThisTurn` worries it longer. Care playing is left to finish (ADR-0005); the
 * rest is cut short, and picks up again after.
 */
export function reactionSpell(
  reaction: WorkReaction,
  previous: Spell | null,
  now: number,
  troubleThisTurn: number,
): Spell {
  if (previous !== null && isCaring(previous, now)) return previous
  const pose = previous === null ? null : poseAt(previous, now)
  const x = pose?.x ?? 0
  const more = reaction === 'worried' ? Math.max(0, troubleThisTurn - 1) : 0
  const lasts = Math.min(MAX_WORRY_MS, REACTION_MS + more * MORE_WORRY_MS)
  const { frameMs, passes } = PLAY[reaction]
  const playMs = Math.min(lasts, frameMs * PET_FRAMES[reaction].length * passes)
  return {
    behaviour: reaction,
    startedAt: now,
    fromX: x,
    toX: x,
    facing: pose?.facing ?? 'right',
    playMs,
    holdMs: lasts - playMs,
    isHungry: false,
  }
}

/**
 * The owner typed, `toX` the column under their caret. The pet trots over and sits
 * watching the prompt until a while after the last key, tilting its head at a `?`. Care
 * and reactions playing are left to finish (ADR-0005); while the pet already watches, it
 * stays put.
 */
export function curiousSpell(
  previous: Spell | null,
  now: number,
  toX: number,
  isQuestion: boolean,
): Spell {
  if (
    previous !== null &&
    (isCaring(previous, now) || isReacting(previous, now) || isToning(previous, now))
  ) {
    return previous
  }
  if (previous?.behaviour === 'curious') {
    return {
      ...previous,
      playMs: now - previous.startedAt + WANDER_AFTER_MS,
      perkedAt: isQuestion ? now : previous.perkedAt,
    }
  }

  const pose = previous === null ? null : poseAt(previous, now)
  const fromX = pose?.x ?? 0
  const facing =
    toX === fromX ? (pose?.facing ?? 'right') : toX > fromX ? 'right' : 'left'
  return {
    behaviour: 'curious',
    startedAt: now,
    fromX,
    toX,
    facing,
    playMs: WANDER_AFTER_MS,
    holdMs: 0,
    isHungry: false,
    perkedAt: isQuestion ? now : null,
  }
}

/**
 * The owner's tone, `caretX` the column the pet would sit at over their caret and `room`
 * how far it can move. Happy wags where it is; angry shrinks back a little away from the
 * caret, still facing it; sad comes over to the caret and lies down beside it. Each lasts
 * about five seconds, the coming close counted from when it arrives. A hungry or tired
 * pet wags slower, and a hungry one comes over slower. Care and reactions playing are
 * left to finish (ADR-0005); the same tone keeps playing.
 */
export function toneSpell(
  tone: FeltTone,
  previous: Spell | null,
  now: number,
  caretX: number,
  room: number,
  mood: Mood = CALM,
): Spell {
  if (previous !== null && (isCaring(previous, now) || isReacting(previous, now))) {
    return previous
  }
  const behaviour = TONE_OF[tone]
  if (previous?.behaviour === behaviour && now < spellEndsAt(previous)) return previous

  const maxX = Math.max(0, room)
  const pose = previous === null ? null : poseAt(previous, now)
  const x = Math.min(pose?.x ?? 0, maxX)
  const facing = pose?.facing ?? 'right'
  const base = { behaviour, startedAt: now, fromX: x, isHungry: false } as const

  if (behaviour === 'wagging') {
    const isWeary = mood.isHungry || mood.isTired
    const { passes } = PLAY.wagging
    const frameMs = frameMsOf(behaviour, false, isWeary)
    const playMs = Math.min(REACTION_MS, frameMs * PET_FRAMES.wagging.length * passes)
    return { ...base, toX: x, facing, playMs, holdMs: REACTION_MS - playMs, isWeary }
  }

  if (behaviour === 'shrinkingBack') {
    const away = caretX > x ? -1 : 1
    const toX = Math.max(0, Math.min(maxX, x + away * MIN_WALK_COLUMNS))
    const playMs = Math.max(1, Math.abs(toX - x)) * PLAY.shrinkingBack.frameMs
    return {
      ...base,
      toX,
      facing: away < 0 ? 'right' : 'left',
      playMs,
      holdMs: REACTION_MS - playMs,
    }
  }

  const toX = Math.max(0, Math.min(maxX, Math.round(caretX)))
  return {
    ...base,
    isHungry: mood.isHungry,
    toX,
    facing: toX === x ? facing : toX > x ? 'right' : 'left',
    playMs: Math.abs(toX - x) * frameMsOf('walk', mood.isHungry),
    holdMs: REACTION_MS,
  }
}

const TONE_OF: Readonly<Record<FeltTone, ToneReaction>> = {
  happy: 'wagging',
  angry: 'shrinkingBack',
  sad: 'comingClose',
}

/** The owner sent or cleared the prompt: a watching pet wanders off now. */
export function wanderOff(spell: Spell, now: number): Spell {
  if (spell.behaviour !== 'curious') return spell
  return { ...spell, playMs: Math.max(0, now - spell.startedAt), holdMs: 0 }
}

/** Which way of thinking a tool call of Claude's shows as. */
export function thinkingOf(tool: string): Thinking {
  if (['Read', 'Grep', 'Glob', 'LSP', 'WebFetch', 'WebSearch'].includes(tool))
    return 'sniffing'
  if (['Edit', 'Write', 'NotebookEdit'].includes(tool)) return 'carrying'
  if (tool === 'Agent') return 'waiting'
  return 'watching'
}

/**
 * Claude works: the pet thinks along. Sniffing and carrying walk a little way about,
 * watching sits and holds still, and watching a long while becomes a patient wait, lying
 * down, which dozes off after about two minutes. Care, reactions and curiosity playing are
 * left to finish (ADR-0005); the same thinking keeps going until its spell ends.
 */
export function workSpell(
  previous: Spell | null,
  now: number,
  work: Work,
  room: number,
  random: Random,
): Spell {
  if (previous !== null && outranksWork(previous, now)) return previous
  const longWait = work.thinking === 'watching' && now - work.since >= LONG_WAIT_MS
  const behaviour: Thinking = longWait ? 'waiting' : work.thinking
  if (previous?.behaviour === behaviour && now < spellEndsAt(previous)) return previous

  const maxX = Math.max(0, room)
  const pose = previous === null ? null : poseAt(previous, now)
  const x = Math.min(pose?.x ?? 0, maxX)
  const facing = pose?.facing ?? 'right'
  const { frameMs } = PLAY[behaviour]
  const base = { behaviour, startedAt: now, fromX: x, isHungry: false } as const

  if (behaviour === 'sniffing' || behaviour === 'carrying') {
    const toX = nearby(x, maxX, random)
    return {
      ...base,
      toX,
      facing: toX === x ? facing : toX > x ? 'right' : 'left',
      playMs: Math.max(Math.abs(toX - x), 1) * frameMs,
      holdMs: 0,
    }
  }

  const playMs = frameMs * PET_FRAMES[behaviour].length
  const holdMs =
    behaviour === 'waiting'
      ? WAIT_HOLD_MS
      : Math.max(0, work.since + LONG_WAIT_MS - now - playMs)
  return { ...base, toX: x, facing, playMs, holdMs }
}

/** The turn completed: thinking ends now, and idle life picks up. */
export function doneWorking(spell: Spell, now: number): Spell {
  if (!(THINKING as readonly string[]).includes(spell.behaviour)) return spell
  return { ...spell, playMs: Math.max(0, now - spell.startedAt), holdMs: 0 }
}

function outranksWork(spell: Spell, now: number): boolean {
  return (
    (isCaring(spell, now) ||
      isReacting(spell, now) ||
      isToning(spell, now) ||
      spell.behaviour === 'curious') &&
    now < spellEndsAt(spell)
  )
}

function isToning(spell: Spell, now: number): boolean {
  return (
    (TONE_REACTIONS as readonly string[]).includes(spell.behaviour) &&
    now < spellEndsAt(spell)
  )
}

function isReacting(spell: Spell, now: number): boolean {
  return (
    (WORK_REACTIONS as readonly string[]).includes(spell.behaviour) &&
    now < spellEndsAt(spell)
  )
}

function isCaring(spell: Spell, now: number): boolean {
  const isCare = (CARE as readonly string[]).includes(spell.behaviour) || spell.isTreat
  return isCare === true && now < spellEndsAt(spell)
}

export function spellEndsAt(spell: Spell): number {
  return spell.startedAt + spell.playMs + spell.holdMs
}

export function poseAt(spell: Spell, now: number): Pose {
  const elapsed = Math.max(0, now - spell.startedAt)
  const { behaviour, facing, isHungry } = spell
  if (behaviour === 'curious') return curiousPose(spell, now)
  if (behaviour === 'comingClose') return comingClosePose(spell, now)

  if (behaviour === 'waiting' && elapsed >= DOZE_AFTER_MS) {
    return {
      behaviour: 'sleep',
      frame: 0,
      x: spell.toX,
      facing,
      hasEmptyBowl: false,
      isMoving: false,
      nextAt: spellEndsAt(spell),
    }
  }

  if (elapsed >= spell.playMs && behaviour !== 'walk') {
    const held = HOLD_AS[behaviour]
    return {
      behaviour: held,
      frame: 0,
      x: spell.toX,
      facing,
      hasEmptyBowl: isHungry && held === 'sit',
      isMoving: false,
      nextAt:
        behaviour === 'waiting'
          ? Math.min(spell.startedAt + DOZE_AFTER_MS, spellEndsAt(spell))
          : spellEndsAt(spell),
    }
  }

  const frameMs = frameMsOf(behaviour, isHungry, spell.isWeary)
  const step = Math.floor(elapsed / frameMs)
  const walked = Math.min(step, Math.abs(spell.toX - spell.fromX))
  const x = spell.fromX + (spell.toX >= spell.fromX ? walked : -walked)

  return {
    behaviour,
    frame: step % PET_FRAMES[behaviour].length,
    x,
    facing,
    hasEmptyBowl: isHungry && behaviour === 'sit',
    isMoving: elapsed < spell.playMs,
    nextAt: Math.min(spell.startedAt + (step + 1) * frameMs, spellEndsAt(spell)),
  }
}

/** Trotting over at walking pace, then watching: still, but for a head tilt at a `?`. */
function curiousPose(spell: Spell, now: number): Pose {
  const elapsed = Math.max(0, now - spell.startedAt)
  const columns = Math.abs(spell.toX - spell.fromX)
  const end = spellEndsAt(spell)
  const still = { x: spell.toX, facing: spell.facing, hasEmptyBowl: false }

  if (elapsed < columns * MIN_FRAME_MS) {
    const step = Math.floor(elapsed / MIN_FRAME_MS)
    return {
      ...still,
      behaviour: 'walk',
      frame: step % PET_FRAMES.walk.length,
      x: spell.fromX + (spell.toX > spell.fromX ? step : -step),
      isMoving: true,
      nextAt: Math.min(spell.startedAt + (step + 1) * MIN_FRAME_MS, end),
    }
  }

  const { frameMs } = PLAY.curious
  const tilt = PET_FRAMES.curious.length - 1
  const since = spell.perkedAt == null ? Infinity : now - spell.perkedAt
  if (since >= 0 && since < tilt * frameMs) {
    const step = Math.floor(since / frameMs)
    return {
      ...still,
      behaviour: 'curious',
      frame: 1 + step,
      isMoving: true,
      nextAt: Math.min(spell.perkedAt! + (step + 1) * frameMs, end),
    }
  }

  return { ...still, behaviour: 'curious', frame: 0, isMoving: false, nextAt: end }
}

/** Walking over at walking pace, then lying down beside the caret, still. */
function comingClosePose(spell: Spell, now: number): Pose {
  const elapsed = Math.max(0, now - spell.startedAt)
  const end = spellEndsAt(spell)
  const still = { x: spell.toX, facing: spell.facing, hasEmptyBowl: false }
  if (elapsed < spell.playMs) {
    const frameMs = frameMsOf('walk', spell.isHungry)
    const step = Math.floor(elapsed / frameMs)
    return {
      ...still,
      behaviour: 'walk',
      frame: step % PET_FRAMES.walk.length,
      x: spell.fromX + (spell.toX > spell.fromX ? step : -step),
      isMoving: true,
      nextAt: Math.min(spell.startedAt + (step + 1) * frameMs, end),
    }
  }
  return { ...still, behaviour: 'lieDown', frame: 0, isMoving: false, nextAt: end }
}

/** A small seeded source (mulberry32), so a test can replay the same idle life. */
export function seededRandom(seed: number): Random {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function frameMsOf(behaviour: Behaviour, isHungry: boolean, isWeary = false): number {
  if (behaviour === 'walk' && isHungry) return HUNGRY_WALK_FRAME_MS
  return PLAY[behaviour].frameMs * (isWeary ? WEARY_SLOWDOWN : 1)
}

function choose(random: Random, canWalk: boolean, mood: Mood): IdleBehaviour | Trick {
  const weight = (one: IdleBehaviour | Trick) =>
    WEIGHTS[one] *
    (one === 'sit' && mood.isHungry ? HUNGRY_SITS : 1) *
    (one === 'sleep' && mood.isTired ? TIRED_SLEEPS : 1)
  const options = [...IDLE_BEHAVIOURS, ...TRICKS].filter(one => canWalk || one !== 'walk')
  const total = options.reduce((sum, one) => sum + weight(one), 0)
  let pick = random() * total
  for (const one of options) {
    pick -= weight(one)
    if (pick < 0) return one
  }
  return options.at(-1)!
}

/** A spot a short walk away, either way, or here when the band has no room. */
function nearby(x: number, maxX: number, random: Random): number {
  const distance =
    MIN_WALK_COLUMNS + Math.floor(random() * (MAX_WORK_WALK - MIN_WALK_COLUMNS + 1))
  const ways = random() < 0.5 ? [-1, 1] : [1, -1]
  for (const way of ways) {
    const toX = Math.max(0, Math.min(maxX, x + way * distance))
    if (Math.abs(toX - x) >= MIN_WALK_COLUMNS) return toX
  }
  return x
}

/** Anywhere in the band at least a short walk away. */
function walkTarget(x: number, maxX: number, random: Random): number {
  const left = Math.max(0, x - MIN_WALK_COLUMNS + 1)
  const right = Math.min(maxX, x + MIN_WALK_COLUMNS - 1)
  const reachable = maxX + 1 - (right - left + 1)
  const pick = Math.floor(random() * reachable)
  return pick < left ? pick : pick + (right - left + 1)
}
