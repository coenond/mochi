import { describe, expect, it } from 'vitest'

import {
  CALM,
  careSpell,
  curiousSpell,
  DOZE_AFTER_MS,
  doneWorking,
  IDLE_BEHAVIOURS,
  LONG_WAIT_MS,
  MIN_WALK_COLUMNS,
  nextSpell,
  poseAt,
  REACTION_MS,
  reactionSpell,
  seededRandom,
  spellEndsAt,
  thinkingOf,
  toneSpell,
  TRICKS,
  treatSpell,
  WANDER_AFTER_MS,
  wanderOff,
  workSpell,
  type Work,
  type Mood,
  type Random,
  type Spell,
} from './idle'
import { PET_FRAMES } from './sheet'

/** A random source that always answers the same, to steer one choice. */
const always =
  (value: number): Random =>
  () =>
    value

/** A random source that makes `treatSpell` do `trick`. */
const pick = (trick: (typeof TRICKS)[number]): Random =>
  always((TRICKS.indexOf(trick) + 0.5) / TRICKS.length)

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

  it('does every idle behaviour and trick now and then', () => {
    const done = new Set(live(24 * 3_600_000, 70, seededRandom(2)).map(s => s.behaviour))

    expect(done).toEqual(new Set([...IDLE_BEHAVIOURS, ...TRICKS]))
  })

  it('does a trick only now and then', () => {
    const spells = live(24 * 3_600_000, 70, seededRandom(3))
    const tricks = spells.filter(s => (TRICKS as readonly string[]).includes(s.behaviour))

    expect(tricks.length / spells.length).toBeGreaterThan(0.01)
    expect(tricks.length / spells.length).toBeLessThan(0.1)
  })

  it('plays a trick twice, then sits still', () => {
    const trick = live(24 * 3_600_000, 70, seededRandom(3)).find(s =>
      (TRICKS as readonly string[]).includes(s.behaviour),
    )!
    const frames = PET_FRAMES[trick.behaviour].length

    expect(trick.playMs % (2 * frames)).toBe(0)
    expect(poseAt(trick, trick.startedAt + trick.playMs - 1).isMoving).toBe(true)
    expect(poseAt(trick, trick.startedAt + trick.playMs)).toMatchObject({
      behaviour: 'sit',
      isMoving: false,
    })
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

  it.each([...IDLE_BEHAVIOURS, ...TRICKS])(
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

describe('curiousSpell', () => {
  const SIT: Spell = { ...WALK, behaviour: 'sit', toX: 10, playMs: 3600, holdMs: 20_000 }

  it('trots over to where the owner types, then sits watching', () => {
    const spell = curiousSpell(SIT, 1000, 30, false)

    expect(spell).toMatchObject({
      behaviour: 'curious',
      fromX: 10,
      toX: 30,
      facing: 'right',
    })
    expect(poseAt(spell, 1000)).toMatchObject({
      behaviour: 'walk',
      x: 10,
      isMoving: true,
    })
    expect(poseAt(spell, 1000 + 5 * 160)).toMatchObject({ behaviour: 'walk', x: 15 })
    expect(poseAt(spell, 1000 + 20 * 160)).toMatchObject({
      behaviour: 'curious',
      frame: 0,
      x: 30,
      isMoving: false,
    })
  })

  it('sits watching where it is when it is already there', () => {
    const spell = curiousSpell(SIT, 1000, 10, false)

    expect(poseAt(spell, 1000)).toMatchObject({ behaviour: 'curious', frame: 0, x: 10 })
  })

  it('holds still while watching: no redraw until it wanders off', () => {
    const spell = curiousSpell(SIT, 1000, 10, false)

    expect(poseAt(spell, 2000).nextAt).toBe(spellEndsAt(spell))
  })

  it('wanders off a while after the last key', () => {
    const spell = curiousSpell(SIT, 1000, 10, false)

    expect(spellEndsAt(spell)).toBe(1000 + WANDER_AFTER_MS)
  })

  it('keeps watching from the same spot while the owner keeps typing', () => {
    const first = curiousSpell(SIT, 1000, 30, false)
    const later = curiousSpell(first, 9000, 50, false)

    expect(later).toMatchObject({ startedAt: 1000, fromX: 10, toX: 30 })
    expect(spellEndsAt(later)).toBe(9000 + WANDER_AFTER_MS)
  })

  it('tilts its head, ears up, at a question mark, then watches again', () => {
    const watching = curiousSpell(SIT, 1000, 10, false)
    const asked = curiousSpell(watching, 5000, 10, true)

    expect(poseAt(asked, 5000)).toMatchObject({
      behaviour: 'curious',
      frame: 1,
      isMoving: true,
    })
    expect(poseAt(asked, 5000 + 500)).toMatchObject({ frame: 2 })
    expect(poseAt(asked, 5000 + 1500)).toMatchObject({ frame: 0, isMoving: false })
  })

  it('does not cut care short (ADR-0005)', () => {
    const eating = careSpell('eating', SIT, 1000)

    expect(curiousSpell(eating, 1500, 30, false)).toBe(eating)
  })

  it('is cut short by care', () => {
    const watching = curiousSpell(SIT, 1000, 10, false)

    expect(careSpell('beingPetted', watching, 2000).behaviour).toBe('beingPetted')
  })

  it('outranks idle life: idle never follows while the owner types', () => {
    const watching = curiousSpell(SIT, 1000, 10, false)

    expect(poseAt(watching, 1000 + WANDER_AFTER_MS - 1).behaviour).toBe('curious')
  })
})

describe('wanderOff', () => {
  it('ends watching now, when the owner sends or clears the prompt', () => {
    const watching = curiousSpell({ ...WALK, toX: 10 }, 1000, 10, false)

    expect(spellEndsAt(wanderOff(watching, 4000))).toBe(4000)
  })

  it('leaves anything else alone', () => {
    expect(wanderOff(WALK, 1200)).toBe(WALK)
  })
})

describe('thinkingOf', () => {
  it.each([
    ['Read', 'sniffing'],
    ['Grep', 'sniffing'],
    ['Glob', 'sniffing'],
    ['WebFetch', 'sniffing'],
    ['WebSearch', 'sniffing'],
    ['Bash', 'watching'],
    ['Edit', 'carrying'],
    ['Write', 'carrying'],
    ['NotebookEdit', 'carrying'],
    ['Agent', 'waiting'],
    ['mcp__github__list_issues', 'watching'],
  ] as const)('%s makes it %s', (tool, thinking) => {
    expect(thinkingOf(tool)).toBe(thinking)
  })
})

describe('workSpell', () => {
  const work = (thinking: Work['thinking'], since = 0): Work => ({ thinking, since })
  const SIT: Spell = {
    ...WALK,
    behaviour: 'sit',
    fromX: 30,
    toX: 30,
    playMs: 3600,
    holdMs: 20_000,
  }

  it.each(['sniffing', 'carrying'] as const)('%s walks to a spot nearby', thinking => {
    const spell = workSpell(SIT, 1000, work(thinking), 60, always(0.9))
    const distance = Math.abs(spell.toX - spell.fromX)

    expect(spell).toMatchObject({ behaviour: thinking, fromX: 30, holdMs: 0 })
    expect(distance).toBeGreaterThanOrEqual(MIN_WALK_COLUMNS)
    expect(distance).toBeLessThanOrEqual(16)
    expect(poseAt(spell, 1000)).toMatchObject({ behaviour: thinking, isMoving: true })
  })

  it('stays put in a band too narrow to walk in', () => {
    const spell = workSpell(null, 0, work('sniffing'), 2, always(0.5))

    expect(spell.toX).toBe(spell.fromX)
  })

  it('watches intently: plays once, then holds still', () => {
    const spell = workSpell(SIT, 1000, work('watching', 1000), 60, always(0.5))

    expect(spell).toMatchObject({ behaviour: 'watching', toX: 30 })
    expect(poseAt(spell, 1000 + spell.playMs)).toMatchObject({
      behaviour: 'watching',
      frame: 0,
      isMoving: false,
      nextAt: spellEndsAt(spell),
    })
  })

  it('lies down patiently when watching goes on a long while', () => {
    const watching = workSpell(SIT, 0, work('watching', 0), 60, always(0.5))

    expect(spellEndsAt(watching)).toBe(LONG_WAIT_MS)
    expect(
      workSpell(watching, LONG_WAIT_MS, work('watching', 0), 60, always(0.5)).behaviour,
    ).toBe('waiting')
  })

  it('lies down patiently for an agent, and dozes after about two minutes', () => {
    const spell = workSpell(SIT, 0, work('waiting'), 60, always(0.5))

    expect(poseAt(spell, spell.playMs)).toMatchObject({
      behaviour: 'waiting',
      isMoving: false,
    })
    expect(poseAt(spell, spell.playMs).nextAt).toBe(DOZE_AFTER_MS)
    expect(poseAt(spell, DOZE_AFTER_MS)).toMatchObject({
      behaviour: 'sleep',
      isMoving: false,
    })
  })

  it('keeps going while the work stays the same', () => {
    const spell = workSpell(SIT, 0, work('waiting'), 60, always(0.5))

    expect(workSpell(spell, 5000, work('waiting'), 60, always(0.1))).toBe(spell)
  })

  it('switches when the tool changes', () => {
    const sniffing = workSpell(SIT, 0, work('sniffing'), 60, always(0.5))

    expect(
      workSpell(sniffing, 300, work('carrying', 300), 60, always(0.5)).behaviour,
    ).toBe('carrying')
  })

  it('gives way to care and to curiosity while they last (ADR-0005)', () => {
    const eating = careSpell('eating', SIT, 0)
    const watchingOwner = curiousSpell(SIT, 0, 30, false)

    expect(workSpell(eating, 500, work('sniffing'), 60, always(0.5))).toBe(eating)
    expect(workSpell(watchingOwner, 500, work('sniffing'), 60, always(0.5))).toBe(
      watchingOwner,
    )
  })

  it('is cut short by curiosity and by care', () => {
    const sniffing = workSpell(SIT, 0, work('sniffing'), 60, always(0.5))

    expect(curiousSpell(sniffing, 100, 30, false).behaviour).toBe('curious')
    expect(careSpell('beingPetted', sniffing, 100).behaviour).toBe('beingPetted')
  })
})

describe('doneWorking', () => {
  it('ends thinking now, when the turn completes', () => {
    const spell = workSpell(null, 0, { thinking: 'waiting', since: 0 }, 60, always(0.5))

    expect(spellEndsAt(doneWorking(spell, 7000))).toBe(7000)
  })

  it('leaves anything else alone', () => {
    expect(doneWorking(WALK, 1200)).toBe(WALK)
  })
})

describe('reactionSpell', () => {
  it.each(['worried', 'celebrating', 'confused'] as const)(
    '%s plays where the pet is, and lasts about five seconds',
    reaction => {
      const spell = reactionSpell(reaction, WALK, 1480, 1)

      expect(spell).toMatchObject({
        behaviour: reaction,
        fromX: 7,
        toX: 7,
        facing: 'left',
      })
      expect(spellEndsAt(spell) - 1480).toBe(REACTION_MS)
      expect(poseAt(spell, 1480)).toMatchObject({ behaviour: reaction, isMoving: true })
    },
  )

  it('moves a while, then holds still for the rest', () => {
    const spell = reactionSpell('worried', null, 0, 1)

    expect(spell.playMs).toBeLessThan(REACTION_MS)
    expect(poseAt(spell, spell.playMs)).toMatchObject({
      behaviour: 'worried',
      frame: 0,
      isMoving: false,
      nextAt: REACTION_MS,
    })
  })

  it('more trouble in the same turn keeps it worried for longer', () => {
    const once = reactionSpell('worried', null, 0, 1)
    const twice = reactionSpell('worried', once, 1000, 2)
    const often = reactionSpell('worried', twice, 2000, 9)

    expect(spellEndsAt(twice) - 1000).toBeGreaterThan(REACTION_MS)
    expect(spellEndsAt(often) - 2000).toBeGreaterThan(spellEndsAt(twice) - 1000)
    expect(spellEndsAt(often) - 2000).toBeLessThanOrEqual(3 * REACTION_MS)
  })

  it('a win or confusion lasts the same however much trouble came before', () => {
    expect(spellEndsAt(reactionSpell('celebrating', null, 0, 4))).toBe(REACTION_MS)
  })

  it('gives way to care playing (ADR-0005)', () => {
    const eating = careSpell('eating', null, 0)

    expect(reactionSpell('worried', eating, 100, 1)).toBe(eating)
  })

  it('is cut short by care', () => {
    const worried = reactionSpell('worried', null, 0, 1)

    expect(careSpell('beingPetted', worried, 100).behaviour).toBe('beingPetted')
  })

  it('outranks curiosity and thinking while it lasts', () => {
    const worried = reactionSpell('worried', null, 0, 1)
    const work: Work = { thinking: 'sniffing', since: 0 }

    expect(curiousSpell(worried, 100, 30, false)).toBe(worried)
    expect(workSpell(worried, 100, work, 60, always(0.5))).toBe(worried)
    expect(doneWorking(worried, 100)).toBe(worried)
    expect(wanderOff(worried, 100)).toBe(worried)
  })

  it('cuts curiosity and thinking short', () => {
    const watching = curiousSpell(null, 0, 30, false)
    const sniffing = workSpell(
      null,
      0,
      { thinking: 'sniffing', since: 0 },
      60,
      always(0.5),
    )

    expect(reactionSpell('confused', watching, 100, 0).behaviour).toBe('confused')
    expect(reactionSpell('worried', sniffing, 100, 1).behaviour).toBe('worried')
  })

  it('once over, thinking picks up again', () => {
    const worried = reactionSpell('worried', null, 0, 1)
    const work: Work = { thinking: 'sniffing', since: 0 }

    expect(workSpell(worried, REACTION_MS, work, 60, always(0.5)).behaviour).toBe(
      'sniffing',
    )
  })
})

describe('treatSpell', () => {
  it('does a trick where the pet is, cutting short what it was doing', () => {
    const spell = treatSpell(WALK, 1480, pick('hop'))

    expect(spell).toMatchObject({ behaviour: 'hop', fromX: 7, toX: 7, holdMs: 0 })
    expect(poseAt(spell, 1480)).toMatchObject({ behaviour: 'hop', isMoving: true })
  })

  it('picks any of the tricks', () => {
    const picked = new Set(
      Array.from({ length: 40 }, (_, i) => treatSpell(null, 0, always(i / 40)).behaviour),
    )

    expect(picked).toEqual(new Set(TRICKS))
  })

  it('comes first, like other care (ADR-0005)', () => {
    const trick = treatSpell(null, 0, pick('spin'))
    const work: Work = { thinking: 'sniffing', since: 0 }

    expect(reactionSpell('worried', trick, 100, 1)).toBe(trick)
    expect(curiousSpell(trick, 100, 30, false)).toBe(trick)
    expect(workSpell(trick, 100, work, 60, always(0.5))).toBe(trick)
  })

  it('cuts care and reactions short', () => {
    const eating = careSpell('eating', null, 0)
    const worried = reactionSpell('worried', null, 0, 1)

    expect(treatSpell(eating, 100, pick('spin')).behaviour).toBe('spin')
    expect(treatSpell(worried, 100, pick('spin')).behaviour).toBe('spin')
  })

  it('a trick done on its own outranks nothing', () => {
    const trick = live(24 * 3_600_000, 70, seededRandom(3)).find(s =>
      (TRICKS as readonly string[]).includes(s.behaviour),
    )!
    const work: Work = { thinking: 'sniffing', since: 0 }
    const now = trick.startedAt + 100

    expect(curiousSpell(trick, now, 30, false).behaviour).toBe('curious')
    expect(workSpell(trick, now, work, 60, always(0.5)).behaviour).toBe('sniffing')
  })
})

describe('toneSpell', () => {
  const SIT: Spell = { ...WALK, behaviour: 'sit', toX: 10, playMs: 3600, holdMs: 20_000 }

  it('happy: wags where it is for about five seconds', () => {
    const spell = toneSpell('happy', SIT, 1000, 30, 60)

    expect(spell).toMatchObject({ behaviour: 'wagging', fromX: 10, toX: 10 })
    expect(spellEndsAt(spell) - 1000).toBe(REACTION_MS)
    expect(poseAt(spell, 1000)).toMatchObject({ behaviour: 'wagging', isMoving: true })
    expect(poseAt(spell, 1000 + spell.playMs)).toMatchObject({ isMoving: false })
  })

  it('angry: shrinks back away from the caret, still facing it, then holds', () => {
    const spell = toneSpell('angry', SIT, 1000, 14, 60)

    expect(spell).toMatchObject({
      behaviour: 'shrinkingBack',
      fromX: 10,
      toX: 10 - MIN_WALK_COLUMNS,
      facing: 'right',
    })
    expect(spellEndsAt(spell) - 1000).toBe(REACTION_MS)
    expect(poseAt(spell, 1000 + spell.playMs)).toMatchObject({
      behaviour: 'shrinkingBack',
      frame: 0,
      x: 10 - MIN_WALK_COLUMNS,
      isMoving: false,
    })
  })

  it('angry: backs the other way when the caret is to its left, and stays in the band', () => {
    expect(toneSpell('angry', SIT, 1000, 2, 60)).toMatchObject({
      toX: 10 + MIN_WALK_COLUMNS,
      facing: 'left',
    })
    expect(toneSpell('angry', { ...SIT, fromX: 1, toX: 1 }, 1000, 20, 60)).toMatchObject({
      toX: 0,
    })
  })

  it('sad: comes over to the caret and lies down beside it', () => {
    const spell = toneSpell('sad', SIT, 1000, 30, 60)

    expect(spell).toMatchObject({
      behaviour: 'comingClose',
      fromX: 10,
      toX: 30,
      facing: 'right',
    })
    expect(poseAt(spell, 1000 + 5 * 160)).toMatchObject({ behaviour: 'walk', x: 15 })
    expect(poseAt(spell, 1000 + 20 * 160)).toMatchObject({
      behaviour: 'lieDown',
      frame: 0,
      x: 30,
      isMoving: false,
      nextAt: spellEndsAt(spell),
    })
    expect(spellEndsAt(spell) - (1000 + 20 * 160)).toBe(REACTION_MS)
  })

  it('sad: comes no further than the band allows', () => {
    expect(toneSpell('sad', SIT, 1000, 90, 40)).toMatchObject({ toX: 40 })
  })

  it('keeps going while the same tone plays', () => {
    const wagging = toneSpell('happy', SIT, 1000, 30, 60)

    expect(toneSpell('happy', wagging, 3000, 40, 60)).toBe(wagging)
  })

  it('a new tone cuts the last one short', () => {
    const wagging = toneSpell('happy', SIT, 1000, 30, 60)

    expect(toneSpell('sad', wagging, 2000, 30, 60).behaviour).toBe('comingClose')
  })

  it('gives way to care and to trouble, wins and confusion playing (ADR-0005)', () => {
    const eating = careSpell('eating', SIT, 1000)
    const worried = reactionSpell('worried', SIT, 1000, 1)

    expect(toneSpell('happy', eating, 1500, 30, 60)).toBe(eating)
    expect(toneSpell('angry', worried, 1500, 30, 60)).toBe(worried)
  })

  it('is cut short by care and by trouble, wins and confusion', () => {
    const wagging = toneSpell('happy', SIT, 1000, 30, 60)

    expect(careSpell('beingPetted', wagging, 1500).behaviour).toBe('beingPetted')
    expect(reactionSpell('worried', wagging, 1500, 1).behaviour).toBe('worried')
  })

  it('cuts curiosity and thinking short, and neither cuts it short (ADR-0005)', () => {
    const watching = curiousSpell(SIT, 1000, 10, false)
    const thinking = workSpell(
      SIT,
      1000,
      { thinking: 'watching', since: 1000 },
      60,
      always(0),
    )
    const sad = toneSpell('sad', watching, 1500, 30, 60)

    expect(sad.behaviour).toBe('comingClose')
    expect(toneSpell('happy', thinking, 1500, 30, 60).behaviour).toBe('wagging')
    expect(curiousSpell(sad, 2000, 30, true)).toBe(sad)
    expect(
      workSpell(sad, 2000, { thinking: 'sniffing', since: 2000 }, 60, always(0)),
    ).toBe(sad)
  })

  it('needs colour it: a hungry or tired pet wags slower, a hungry one comes over slower', () => {
    const calm = toneSpell('happy', SIT, 1000, 30, 60)
    const hungry = toneSpell('happy', SIT, 1000, 30, 60, HUNGRY)
    const tired = toneSpell('happy', SIT, 1000, 30, 60, TIRED)

    expect(poseAt(calm, 1000).nextAt).toBeLessThan(poseAt(hungry, 1000).nextAt)
    expect(poseAt(tired, 1000).nextAt).toBe(poseAt(hungry, 1000).nextAt)
    expect(spellEndsAt(hungry) - 1000).toBe(REACTION_MS)

    const close = toneSpell('sad', SIT, 1000, 30, 60, HUNGRY)
    expect(poseAt(close, 1000 + 20 * 160)).toMatchObject({ behaviour: 'walk' })
  })
})
