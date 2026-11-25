// Idle life: which idle behaviour the pet chooses on its own, where it walks in the band,
// and which frame shows when. Pure: time, the band's room and a random source come in.
//
// The pet lives one spell after another. A spell plays its behaviour's frames, then
// holds one still pose with no redraw at all. Holding lasts about four times as long as
// playing, so the pet moves about a fifth of the time.

import { PET_IDLE } from './sheet'

export const IDLE_BEHAVIOURS = [
  'walk',
  'sit',
  'lieDown',
  'sleep',
  'yawn',
  'scratch',
] as const

export type IdleBehaviour = (typeof IDLE_BEHAVIOURS)[number]

export type Facing = 'left' | 'right'

/** Numbers from 0 up to 1, as `Math.random` gives them. */
export type Random = () => number

/** One stretch of an idle behaviour: played from `startedAt` for `playMs`, then held. */
export type Spell = {
  behaviour: IdleBehaviour
  startedAt: number
  /** Columns from the band's left edge, where the spell starts and ends. */
  fromX: number
  toX: number
  facing: Facing
  playMs: number
  holdMs: number
}

/** What the band draws at one moment, and when it next needs drawing. */
export type Pose = {
  behaviour: IdleBehaviour
  frame: number
  x: number
  facing: Facing
  isMoving: boolean
  nextAt: number
}

/** The shortest walk worth taking, in columns. */
export const MIN_WALK_COLUMNS = 4

/** About 6 frames a second at most (spec: 6 to 9 while moving). */
const MIN_FRAME_MS = 160
const STILL_PER_MOVING = 4
/** Holds vary from 75% to 125% of their share, so the pet does not tick like a clock. */
const HOLD_JITTER = 0.5

/** How long each frame shows, and how many times the frames play before the hold. */
const PLAY: Readonly<Record<IdleBehaviour, { frameMs: number; passes: number }>> = {
  walk: { frameMs: MIN_FRAME_MS, passes: 1 },
  sit: { frameMs: 600, passes: 1 },
  lieDown: { frameMs: 700, passes: 1 },
  sleep: { frameMs: 1100, passes: 3 },
  yawn: { frameMs: 380, passes: 1 },
  scratch: { frameMs: MIN_FRAME_MS, passes: 5 },
}

/** The behaviour whose first frame is held after playing. */
const HOLD_AS: Readonly<Record<IdleBehaviour, IdleBehaviour>> = {
  walk: 'walk',
  sit: 'sit',
  lieDown: 'lieDown',
  sleep: 'sleep',
  yawn: 'sit',
  scratch: 'sit',
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

/**
 * The spell after `previous`, starting at `now`. `room` is how many columns the pet can
 * move in: the band's width less the pet's own.
 */
export function nextSpell(
  previous: Spell | null,
  now: number,
  room: number,
  random: Random,
): Spell {
  const maxX = Math.max(0, room)
  const x = Math.min(previous?.toX ?? 0, maxX)
  const facing = previous?.facing ?? 'right'
  const canWalk = previous?.behaviour !== 'walk' && maxX >= MIN_WALK_COLUMNS
  const behaviour = choose(random, canWalk)

  if (behaviour === 'walk') {
    const toX = walkTarget(x, maxX, random)
    return {
      behaviour,
      startedAt: now,
      fromX: x,
      toX,
      facing: toX > x ? 'right' : 'left',
      playMs: Math.abs(toX - x) * PLAY.walk.frameMs,
      holdMs: 0,
    }
  }

  const { frameMs, passes } = PLAY[behaviour]
  const playMs = frameMs * PET_IDLE[behaviour].length * passes
  // A walk holds nothing, so the rest after it holds still for both.
  const owed = previous?.behaviour === 'walk' ? previous.playMs : 0
  const jitter = 1 - HOLD_JITTER / 2 + random() * HOLD_JITTER
  const holdMs = Math.round((playMs + owed) * STILL_PER_MOVING * jitter)

  return { behaviour, startedAt: now, fromX: x, toX: x, facing, playMs, holdMs }
}

export function spellEndsAt(spell: Spell): number {
  return spell.startedAt + spell.playMs + spell.holdMs
}

export function poseAt(spell: Spell, now: number): Pose {
  const elapsed = Math.max(0, now - spell.startedAt)
  const { behaviour, facing } = spell

  if (elapsed >= spell.playMs && behaviour !== 'walk') {
    return {
      behaviour: HOLD_AS[behaviour],
      frame: 0,
      x: spell.toX,
      facing,
      isMoving: false,
      nextAt: spellEndsAt(spell),
    }
  }

  const { frameMs } = PLAY[behaviour]
  const step = Math.floor(elapsed / frameMs)
  const walked = Math.min(step, Math.abs(spell.toX - spell.fromX))
  const x = spell.fromX + (spell.toX >= spell.fromX ? walked : -walked)

  return {
    behaviour,
    frame: step % PET_IDLE[behaviour].length,
    x,
    facing,
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

function choose(random: Random, canWalk: boolean): IdleBehaviour {
  const options = IDLE_BEHAVIOURS.filter(one => canWalk || one !== 'walk')
  const total = options.reduce((sum, one) => sum + WEIGHTS[one], 0)
  let pick = random() * total
  for (const one of options) {
    pick -= WEIGHTS[one]
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
