// Idle life: which idle behaviour the pet chooses on its own, where it walks in the band,
// and which frame shows when. Pure: time, the band's room, the pet's mood and a random
// source come in. Care (eating, being petted) plays as a spell of its own, cutting short
// whatever the pet was doing: it takes top priority (ADR-0005).
//
// The pet lives one spell after another. A spell plays its behaviour's frames, then
// holds one still pose with no redraw at all. Holding lasts about four times as long as
// playing, so the pet moves about a fifth of the time.

import { PET_FRAMES } from './sheet'

export const IDLE_BEHAVIOURS = [
  'walk',
  'sit',
  'lieDown',
  'sleep',
  'yawn',
  'scratch',
] as const

export type IdleBehaviour = (typeof IDLE_BEHAVIOURS)[number]

/** The reactions to the owner's care, which come before anything else (ADR-0005). */
export const CARE = ['eating', 'beingPetted'] as const

export type Care = (typeof CARE)[number]

export const BEHAVIOURS = [...IDLE_BEHAVIOURS, ...CARE] as const

/** The idle behaviours, and the reactions built so far. */
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
/** A hungry pet walks at about 4 frames a second. */
const HUNGRY_WALK_FRAME_MS = 240
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
  eating: { frameMs: 220, passes: 2 },
  beingPetted: { frameMs: 220, passes: 2 },
}

/** The behaviour whose first frame is held after playing. */
const HOLD_AS: Readonly<Record<Behaviour, Behaviour>> = {
  walk: 'walk',
  sit: 'sit',
  lieDown: 'lieDown',
  sleep: 'sleep',
  yawn: 'sit',
  scratch: 'sit',
  eating: 'sit',
  beingPetted: 'sit',
}

/** How often each is chosen, against the others. */
const WEIGHTS: Readonly<Record<IdleBehaviour, number>> = {
  walk: 3,
  sit: 3,
  lieDown: 2,
  sleep: 1,
  yawn: 1,
  scratch: 1,
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

export function spellEndsAt(spell: Spell): number {
  return spell.startedAt + spell.playMs + spell.holdMs
}

export function poseAt(spell: Spell, now: number): Pose {
  const elapsed = Math.max(0, now - spell.startedAt)
  const { behaviour, facing, isHungry } = spell

  if (elapsed >= spell.playMs && behaviour !== 'walk') {
    const held = HOLD_AS[behaviour]
    return {
      behaviour: held,
      frame: 0,
      x: spell.toX,
      facing,
      hasEmptyBowl: isHungry && held === 'sit',
      isMoving: false,
      nextAt: spellEndsAt(spell),
    }
  }

  const frameMs = frameMsOf(behaviour, isHungry)
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

function frameMsOf(behaviour: Behaviour, isHungry: boolean): number {
  return behaviour === 'walk' && isHungry ? HUNGRY_WALK_FRAME_MS : PLAY[behaviour].frameMs
}

function choose(random: Random, canWalk: boolean, mood: Mood): IdleBehaviour {
  const weight = (one: IdleBehaviour) =>
    WEIGHTS[one] *
    (one === 'sit' && mood.isHungry ? HUNGRY_SITS : 1) *
    (one === 'sleep' && mood.isTired ? TIRED_SLEEPS : 1)
  const options = IDLE_BEHAVIOURS.filter(one => canWalk || one !== 'walk')
  const total = options.reduce((sum, one) => sum + weight(one), 0)
  let pick = random() * total
  for (const one of options) {
    pick -= weight(one)
    if (pick < 0) return one
  }
  return options.at(-1)!
}

/** Anywhere in the band at least a short walk away. */
function walkTarget(x: number, maxX: number, random: Random): number {
  const left = Math.max(0, x - MIN_WALK_COLUMNS + 1)
  const right = Math.min(maxX, x + MIN_WALK_COLUMNS - 1)
  const reachable = maxX + 1 - (right - left + 1)
  const pick = Math.floor(random() * reachable)
  return pick < left ? pick : pick + (right - left + 1)
}
