import { describe, expect, it } from 'vitest'

import {
  CLOSED_AFTER_MS,
  feed,
  freshNeeds,
  isHungry,
  isTired,
  passTime,
  petting,
  troubled,
  won,
  storedNeeds,
  type Needs,
} from './needs'

const MINUTE = 60_000
const HOUR = 60 * MINUTE

const FULL: Needs = { hunger: 100, happiness: 100, energy: 100, at: 0 }

describe('freshNeeds', () => {
  it('starts a new pet full, happy and rested', () => {
    expect(freshNeeds(5)).toEqual({ hunger: 100, happiness: 100, energy: 100, at: 5 })
  })
})

describe('passTime', () => {
  it('empties hunger over about eight hours', () => {
    expect(passTime(FULL, 4 * HOUR, false).hunger).toBeCloseTo(50)
    expect(passTime(FULL, 8 * HOUR, false).hunger).toBe(0)
  })

  it('drains energy over about sixteen hours awake', () => {
    expect(passTime(FULL, 4 * MINUTE, false).energy).toBeCloseTo(
      100 - (100 * 4) / (16 * 60),
    )
  })

  it('refills energy over about two hours asleep', () => {
    const tired = { ...FULL, energy: 0 }

    expect(passTime(tired, 1 * MINUTE, true).energy).toBeCloseTo(100 / 120)
  })

  it('lowers happiness over about a day of neglect', () => {
    expect(passTime(FULL, 12 * HOUR, false).happiness).toBeCloseTo(50)
  })

  it('counts a long gap as Claude Code closed, and the pet asleep through it', () => {
    const tired = { ...FULL, energy: 10 }
    const night = passTime(tired, 8 * HOUR, false)

    expect(night.energy).toBe(100)
    expect(night.hunger).toBe(0)
  })

  it('counts a short gap as the session it was', () => {
    const gap = CLOSED_AFTER_MS - 1

    expect(passTime(FULL, gap, false).energy).toBeLessThan(100)
  })

  it('bottoms out at 0 and never goes past it, however long the owner is away', () => {
    const later = passTime(FULL, 365 * 24 * HOUR, false)

    expect(later).toEqual({ hunger: 0, happiness: 0, energy: 100, at: 365 * 24 * HOUR })
  })

  it('stops at 100 when refilling', () => {
    expect(passTime(FULL, 3 * HOUR, true).energy).toBe(100)
  })

  it('stamps the time it brought the needs up to', () => {
    expect(passTime(FULL, 1234, false).at).toBe(1234)
  })

  it('leaves the needs as they are for a clock that went back', () => {
    expect(passTime({ ...FULL, at: 5000 }, 1000, false)).toEqual({ ...FULL, at: 5000 })
  })
})

describe('feed', () => {
  it('fills hunger by a bowl of kibble', () => {
    expect(feed({ ...FULL, hunger: 40 })).toEqual({
      isRefused: false,
      needs: { ...FULL, hunger: 70 },
    })
  })

  it('never fills past full', () => {
    expect(feed({ ...FULL, hunger: 85 }).needs.hunger).toBe(100)
  })

  it('is refused by a full pet', () => {
    expect(feed({ ...FULL, hunger: 90 })).toEqual({
      isRefused: true,
      needs: { ...FULL, hunger: 90 },
    })
  })
})

describe('isHungry and isTired', () => {
  it('is hungry under 25', () => {
    expect(isHungry({ ...FULL, hunger: 24 })).toBe(true)
    expect(isHungry({ ...FULL, hunger: 25 })).toBe(false)
  })

  it('is tired under 25', () => {
    expect(isTired({ ...FULL, energy: 24 })).toBe(true)
    expect(isTired({ ...FULL, energy: 25 })).toBe(false)
  })
})

describe('storedNeeds', () => {
  it('reads back needs that were stored', () => {
    expect(storedNeeds({ hunger: 1, happiness: 2, energy: 3, at: 4 })).toEqual({
      hunger: 1,
      happiness: 2,
      energy: 3,
      at: 4,
    })
  })

  it('clamps a level out of range', () => {
    expect(storedNeeds({ hunger: 140, happiness: -3, energy: 50, at: 4 })).toMatchObject({
      hunger: 100,
      happiness: 0,
    })
  })

  it.each([
    ['nothing', undefined],
    ['a missing level', { hunger: 1, happiness: 2, at: 4 }],
    ['a level that is not a number', { hunger: '1', happiness: 2, energy: 3, at: 4 }],
    ['no time', { hunger: 1, happiness: 2, energy: 3 }],
    ['not a number at all', { hunger: NaN, happiness: 2, energy: 3, at: 4 }],
  ])('finds no needs in %s', (_, value) => {
    expect(storedNeeds(value)).toBeNull()
  })
})

describe('petting', () => {
  it('makes the pet happier', () => {
    expect(petting({ ...FULL, happiness: 50 })).toEqual({ ...FULL, happiness: 60 })
  })

  it('never past 100', () => {
    expect(petting({ ...FULL, happiness: 95 }).happiness).toBe(100)
  })
})

describe('troubled', () => {
  it('makes the pet a little less happy', () => {
    expect(troubled({ ...FULL, happiness: 50 })).toEqual({ ...FULL, happiness: 45 })
  })

  it('never under 0', () => {
    expect(troubled({ ...FULL, happiness: 2 }).happiness).toBe(0)
  })
})

describe('won', () => {
  it('makes the pet happier', () => {
    expect(won({ ...FULL, happiness: 50 })).toEqual({ ...FULL, happiness: 65 })
  })

  it('never past 100', () => {
    expect(won({ ...FULL, happiness: 95 }).happiness).toBe(100)
  })
})
