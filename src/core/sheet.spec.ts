import { describe, expect, it } from 'vitest'

import { IDLE_BEHAVIOURS } from './idle'
import {
  BASKET,
  FALLBACK_BASKET,
  FALLBACK_IDLE,
  FALLBACK_SIT,
  PET_IDLE,
  PET_SIT,
} from './sheet'
import { COATS, toRgba, type Sprite } from './sprites'

const SHEET: [string, Sprite, number, number][] = [
  ['the pet sitting', PET_SIT, 32, 24],
  ['the fallback pet sitting', FALLBACK_SIT, 24, 10],
  ['the basket', BASKET, 32, 24],
  ['the fallback basket', FALLBACK_BASKET, 24, 10],
  ...IDLE_BEHAVIOURS.flatMap(behaviour => [
    ...PET_IDLE[behaviour].map((frame, i): [string, Sprite, number, number] => [
      `${behaviour} frame ${i}`,
      frame,
      32,
      24,
    ]),
    ...FALLBACK_IDLE[behaviour].map((frame, i): [string, Sprite, number, number] => [
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
  it.each(IDLE_BEHAVIOURS)('%s has 2 to 6 frames', behaviour => {
    expect(PET_IDLE[behaviour].length).toBeGreaterThanOrEqual(2)
    expect(PET_IDLE[behaviour].length).toBeLessThanOrEqual(6)
  })

  it('sit starts with the still pet', () => {
    expect(PET_IDLE.sit[0]).toBe(PET_SIT)
    expect(FALLBACK_IDLE.sit[0]).toBe(FALLBACK_SIT)
  })

  it('the fallback draws only walk, sit and sleep, and borrows them for the rest (ADR-0007)', () => {
    expect(FALLBACK_IDLE.lieDown).toBe(FALLBACK_IDLE.sleep)
    expect(FALLBACK_IDLE.yawn).toBe(FALLBACK_IDLE.sit)
    expect(FALLBACK_IDLE.scratch).toBe(FALLBACK_IDLE.sit)
  })
})
