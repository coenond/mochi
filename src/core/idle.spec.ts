import { describe, expect, it } from 'vitest'

import {
  CALM,
  careSpell,
  IDLE_BEHAVIOURS,
  MIN_WALK_COLUMNS,
  nextSpell,
  poseAt,
  seededRandom,
  spellEndsAt,
  type Mood,
  type Random,
  type Spell,
} from './idle'

/** A random source that always answers the same, to steer one choice. */
const always =
  (value: number): Random =>
  () =>
    value

/** Lives the pet's idle life for `ms` from 0, a spell after the other. */
function live(ms: number, room: number, random: Random, mood: Mood = CALM): Spell[] {
  const spells: Spell[] = []
  let spell = nextSpell(null, 0, room, random, mood)
  while (spell.startedAt < ms) {
    spells.push(spell)
    spell = nextSpell(spell, spellEndsAt(spell), room, random, mood)
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
  isHungry: false,
}

const HUNGRY: Mood = { isHungry: true, isTired: false }
const TIRED: Mood = { isHungry: false, isTired: true }

/** How much of the time the pet spends on `behaviour` over a long life. */
function share(spells: Spell[], behaviour: Spell['behaviour']): number {
  const time = (s: Spell) => s.playMs + s.holdMs
  const all = spells.reduce((sum, s) => sum + time(s), 0)
  return (
    spells.filter(s => s.behaviour === behaviour).reduce((sum, s) => sum + time(s), 0) /
    all
  )
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
      isHungry: false,
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

describe('needs shape idle life', () => {
  it('walks slower when hungry', () => {
    const calm = nextSpell(null, 0, 60, always(0))
    const hungry = nextSpell(null, 0, 60, always(0), HUNGRY)
    const columns = Math.abs(hungry.toX - hungry.fromX)

    expect(hungry.playMs).toBe(columns * 240)
    expect(poseAt(hungry, 240)).toMatchObject({ frame: 1, nextAt: 480 })
    expect(calm.playMs).toBe(Math.abs(calm.toX - calm.fromX) * 160)
  })

  it('sits by the empty bowl when hungry, and more often', () => {
    const calm = share(live(24 * 3_600_000, 70, seededRandom(4)), 'sit')
    const spells = live(24 * 3_600_000, 70, seededRandom(4), HUNGRY)

    expect(share(spells, 'sit')).toBeGreaterThan(calm * 1.5)
    const sit = spells.find(s => s.behaviour === 'sit')!
    expect(poseAt(sit, sit.startedAt).hasEmptyBowl).toBe(true)
    expect(poseAt(sit, sit.startedAt + sit.playMs).hasEmptyBowl).toBe(true)
  })

  it('shows no bowl when the pet is not hungry, or not sitting', () => {
    const sit = live(3_600_000, 70, seededRandom(4)).find(s => s.behaviour === 'sit')!
    const walk = nextSpell(null, 0, 60, always(0), HUNGRY)

    expect(poseAt(sit, sit.startedAt).hasEmptyBowl).toBe(false)
    expect(poseAt(walk, 0).hasEmptyBowl).toBe(false)
  })

  it('sleeps more when tired', () => {
    const calm = share(live(24 * 3_600_000, 70, seededRandom(5)), 'sleep')
    const tired = share(live(24 * 3_600_000, 70, seededRandom(5), TIRED), 'sleep')

    expect(tired).toBeGreaterThan(calm * 2)
  })
})

describe('careSpell', () => {
  it('eats where the pet is, facing the same way, then goes back to idle life', () => {
    const spell = careSpell('eating', WALK, 1500)

    expect(spell).toMatchObject({
      behaviour: 'eating',
      startedAt: 1500,
      fromX: 7,
      toX: 7,
      facing: 'left',
      holdMs: 0,
    })
    expect(poseAt(spell, 1500)).toMatchObject({
      behaviour: 'eating',
      frame: 0,
      isMoving: true,
    })
  })

  it('plays the eating frames twice, a few seconds in all', () => {
    const spell = careSpell('eating', null, 0)

    expect(spell.playMs).toBeGreaterThanOrEqual(2000)
    expect(spell.playMs).toBeLessThanOrEqual(4000)
  })

  it('is followed by an idle behaviour', () => {
    const spell = careSpell('eating', null, 0)
    const after = nextSpell(spell, spellEndsAt(spell), 60, always(0.5))

    expect(IDLE_BEHAVIOURS).toContain(after.behaviour)
  })
})

describe('care comes first (ADR-0005)', () => {
  it('cuts short any idle behaviour', () => {
    for (const behaviour of IDLE_BEHAVIOURS) {
      const spell = { ...WALK, behaviour }

      expect(careSpell('beingPetted', spell, 1200).behaviour).toBe('beingPetted')
    }
  })

  it('lets petting cut eating short, and feeding cut petting short', () => {
    const eating = careSpell('eating', null, 0)
    const petted = careSpell('beingPetted', eating, 500)

    expect(petted.behaviour).toBe('beingPetted')
    expect(careSpell('eating', petted, 800).behaviour).toBe('eating')
  })

  it('plays being petted for a couple of seconds, turned to the owner where it is', () => {
    const spell = careSpell('beingPetted', WALK, 1500)

    expect(spell).toMatchObject({ fromX: 7, toX: 7, facing: 'left', holdMs: 0 })
    expect(spell.playMs).toBeGreaterThanOrEqual(1500)
    expect(spell.playMs).toBeLessThanOrEqual(3000)
  })
})
