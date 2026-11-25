import { describe, expect, it } from 'vitest'

import { BEHAVIOURS, IDLE_BEHAVIOURS } from './idle'
import {
  BASKET,
  EMPTY_BOWL,
  FALLBACK_BASKET,
  FALLBACK_EMPTY_BOWL,
  FALLBACK_FRAMES,
  FALLBACK_SIT,
  PET_FRAMES,
  PET_SIT,
} from './sheet'
import { COATS, toRgba, type Sprite } from './sprites'

const SHEET: [string, Sprite, number, number][] = [
  ['the pet sitting', PET_SIT, 32, 24],
  ['the fallback pet sitting', FALLBACK_SIT, 24, 10],
  ['the basket', BASKET, 32, 24],
  ['the fallback basket', FALLBACK_BASKET, 24, 10],
  ['the empty bowl', EMPTY_BOWL, 12, 24],
  ['the fallback empty bowl', FALLBACK_EMPTY_BOWL, 6, 10],
  ...BEHAVIOURS.flatMap(behaviour => [
    ...PET_FRAMES[behaviour].map((frame, i): [string, Sprite, number, number] => [
      `${behaviour} frame ${i}`,
      frame,
      32,
      24,
    ]),
    ...FALLBACK_FRAMES[behaviour].map((frame, i): [string, Sprite, number, number] => [
      `fallback ${behaviour} frame ${i}`,
      frame,
      24,
      10,
    ]),
  ]),
]

describe.each(SHEET)('%s', (_, sprite, width, height) => {
  it(`is ${width} by ${height} pixels`, () => {
    expect(sprite.pixels).toHaveLength(height)
    for (const row of sprite.pixels) expect(row).toHaveLength(width)
  })

  it.each(COATS)('has a colour for every pixel in the %s coat', coat => {
    expect(() => toRgba(sprite, coat)).not.toThrow()
  })
})

describe('the idle behaviours', () => {
  it.each(BEHAVIOURS)('%s has 2 to 6 frames', behaviour => {
    expect(PET_FRAMES[behaviour].length).toBeGreaterThanOrEqual(2)
    expect(PET_FRAMES[behaviour].length).toBeLessThanOrEqual(6)
  })

  it('sit starts with the still pet', () => {
    expect(PET_FRAMES.sit[0]).toBe(PET_SIT)
    expect(FALLBACK_FRAMES.sit[0]).toBe(FALLBACK_SIT)
  })

  it('the fallback draws only walk, sit and sleep, and borrows them for the rest (ADR-0007)', () => {
    expect(FALLBACK_FRAMES.lieDown).toBe(FALLBACK_FRAMES.sleep)
    expect(FALLBACK_FRAMES.yawn).toBe(FALLBACK_FRAMES.sit)
    expect(FALLBACK_FRAMES.scratch).toBe(FALLBACK_FRAMES.sit)
    expect(FALLBACK_FRAMES.eating).toBe(FALLBACK_FRAMES.sit)
  })
})
