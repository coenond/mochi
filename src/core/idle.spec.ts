import { describe, expect, it } from 'vitest'

import {
  IDLE_BEHAVIOURS,
  MIN_WALK_COLUMNS,
  nextSpell,
  poseAt,
  seededRandom,
  spellEndsAt,
  type Random,
  type Spell,
} from './idle'

/** A random source that always answers the same, to steer one choice. */
const always =
  (value: number): Random =>
  () =>
    value

/** Lives the pet's idle life for `ms` from 0, a spell after the other. */
function live(ms: number, room: number, random: Random): Spell[] {
  const spells: Spell[] = []
  let spell = nextSpell(null, 0, room, random)
  while (spell.startedAt < ms) {
    spells.push(spell)
    spell = nextSpell(spell, spellEndsAt(spell), room, random)
  }
  return spells
}

const WALK: Spell = {
  behaviour: 'walk',
  startedAt: 1000,
  fromX: 10,
  toX: 4,
  facing: 'left',
  playMs: 6 * 160,
  holdMs: 0,
}

describe('seededRandom', () => {
  it('gives the same numbers for the same seed, each from 0 up to 1', () => {
    const a = seededRandom(7)
    const b = seededRandom(7)
    const numbers = Array.from({ length: 100 }, () => a())

    expect(numbers).toEqual(Array.from({ length: 100 }, () => b()))
    for (const n of numbers) {
      expect(n).toBeGreaterThanOrEqual(0)
      expect(n).toBeLessThan(1)
    }
  })
})

describe('nextSpell', () => {
  it('walks to a spot in the band and faces where it goes', () => {
    const spell = nextSpell(null, 0, 60, always(0))

    expect(spell.behaviour).toBe('walk')
    expect(spell.toX).toBeGreaterThanOrEqual(0)
    expect(spell.toX).toBeLessThanOrEqual(60)
    expect(Math.abs(spell.toX - spell.fromX)).toBeGreaterThanOrEqual(MIN_WALK_COLUMNS)
    expect(spell.facing).toBe(spell.toX > spell.fromX ? 'right' : 'left')
  })

  it('never walks twice in a row', () => {
    for (const spell of [0, 0.3, 0.6, 0.99].map(n =>
      nextSpell(WALK, 2000, 60, always(n)),
    )) {
      expect(spell.behaviour).not.toBe('walk')
    }
  })

  it('rests where the walk ended, facing the same way', () => {
    const spell = nextSpell(WALK, spellEndsAt(WALK), 60, always(0.5))

    expect(spell).toMatchObject({ fromX: 4, toX: 4, facing: 'left' })
  })

  it('does not walk in a band too narrow to walk in, and stays at its edge', () => {
    for (const spell of live(60 * 60_000, MIN_WALK_COLUMNS - 1, seededRandom(3))) {
      expect(spell.behaviour).not.toBe('walk')
      expect(spell.toX).toBe(0)
    }
  })

  it('comes back into a band that got narrower', () => {
    const spell = nextSpell({ ...WALK, toX: 50 }, 5000, 20, always(0.5))

    expect(spell.fromX).toBe(20)
  })

  it('walks the full band width, turning at both edges', () => {
    const spells = live(24 * 3_600_000, 70, seededRandom(1)).filter(
      s => s.behaviour === 'walk',
    )

    expect(Math.min(...spells.map(s => s.toX))).toBeLessThanOrEqual(2)
    expect(Math.max(...spells.map(s => s.toX))).toBeGreaterThanOrEqual(68)
    expect(new Set(spells.map(s => s.facing))).toEqual(new Set(['left', 'right']))
  })

  it('does every idle behaviour now and then', () => {
    const done = new Set(live(24 * 3_600_000, 70, seededRandom(2)).map(s => s.behaviour))

    expect(done).toEqual(new Set(IDLE_BEHAVIOURS))
  })

  it.each([1, 2, 3, 4, 5])('moves about a fifth of the time (seed %i)', seed => {
    const spells = live(24 * 3_600_000, 70, seededRandom(seed))
    const moving = spells.reduce((sum, s) => sum + s.playMs, 0)
    const all = spells.reduce((sum, s) => sum + s.playMs + s.holdMs, 0)

    expect(moving / all).toBeGreaterThan(0.15)
    expect(moving / all).toBeLessThan(0.25)
  })
})

describe('poseAt', () => {
  it('walks one column a frame, stepping through the walk frames', () => {
    expect(poseAt(WALK, 1000)).toMatchObject({ frame: 0, x: 10, isMoving: true })
    expect(poseAt(WALK, 1000 + 160)).toMatchObject({ frame: 1, x: 9 })
    expect(poseAt(WALK, 1000 + 5 * 160 + 20)).toMatchObject({ frame: 1, x: 5 })
  })

  it('asks for the next redraw at the next frame while moving', () => {
    expect(poseAt(WALK, 1000 + 170).nextAt).toBe(1000 + 2 * 160)
  })

  it('arrives where it was going', () => {
    expect(poseAt(WALK, spellEndsAt(WALK)).x).toBe(4)
  })

  it.each(IDLE_BEHAVIOURS)(
    'redraws %s at no more than about 6 frames a second',
    behaviour => {
      const spell = { ...WALK, behaviour, toX: WALK.fromX, playMs: 60_000 }
      const first = poseAt(spell, 1000)

      expect(first.nextAt - 1000).toBeGreaterThanOrEqual(160)
    },
  )

  it('holds still after playing: one pose, no redraw until the spell ends', () => {
    const sit: Spell = {
      behaviour: 'sit',
      startedAt: 0,
      fromX: 3,
      toX: 3,
      facing: 'right',
      playMs: 3600,
      holdMs: 20_000,
    }
    const pose = poseAt(sit, 3600 + 5000)

    expect(pose).toMatchObject({ behaviour: 'sit', frame: 0, x: 3, isMoving: false })
    expect(pose.nextAt).toBe(23_600)
  })

  it.each(['yawn', 'scratch'] as const)('holds still as a sit after a %s', behaviour => {
    const spell: Spell = {
      ...WALK,
      behaviour,
      toX: WALK.fromX,
      playMs: 1000,
      holdMs: 9000,
    }

    expect(poseAt(spell, 1000 + 2000)).toMatchObject({ behaviour: 'sit', frame: 0 })
  })
})
