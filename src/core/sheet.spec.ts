import { describe, expect, it } from 'vitest'

import { BASKET, FALLBACK_BASKET, FALLBACK_SIT, PET_SIT } from './sheet'
import { COATS, toRgba, type Sprite } from './sprites'

const SHEET: [string, Sprite, number, number][] = [
  ['the pet sitting', PET_SIT, 32, 24],
  ['the fallback pet sitting', FALLBACK_SIT, 24, 10],
  ['the basket', BASKET, 32, 24],
  ['the fallback basket', FALLBACK_BASKET, 24, 10],
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
