import { describe, expect, it } from 'vitest'

import { toHalfBlocks, toRgba, toSvg, type Sprite } from './sprites'

// A 2 x 2 sprite: outline top-left, coat top-right, empty bottom-left, eye bottom-right.
const TINY: Sprite = {
  pixels: ['oc', '.e'],
  palette: {
    coats: {
      golden: { o: '#4a2a10', c: '#e9a640' },
      light: { o: '#5a3a1c', c: '#f1cf8a' },
      red: { o: '#3d1d0b', c: '#c9722c' },
    },
    fixed: { e: '#1a120c' },
  },
}

describe('toRgba', () => {
  it('gives one RGBA pixel per sprite pixel, row by row', () => {
    const image = toRgba(TINY, 'golden')

    expect(image.width).toBe(2)
    expect(image.height).toBe(2)
    expect([...image.rgba]).toEqual([
      0x4a, 0x2a, 0x10, 255, 0xe9, 0xa6, 0x40, 255, 0, 0, 0, 0, 0x1a, 0x12, 0x0c, 255,
    ])
  })

  it('paints the coat the owner chose', () => {
    const image = toRgba(TINY, 'red')

    expect([...image.rgba.slice(0, 8)]).toEqual([
      0x3d, 0x1d, 0x0b, 255, 0xc9, 0x72, 0x2c, 255,
    ])
  })

  it('refuses a pixel the palette does not know', () => {
    expect(() => toRgba({ ...TINY, pixels: ['oz', '..'] }, 'golden')).toThrow(/z/)
  })
})

describe('toSvg', () => {
  it('is an SVG with one unit per sprite pixel and crisp edges', () => {
    const svg = toSvg(TINY, 'golden')

    expect(svg).toMatch(/^<svg [^>]*viewBox="0 0 2 2"/)
    expect(svg).toContain('shape-rendering="crispEdges"')
    expect(svg).toMatch(/<\/svg>$/)
  })

  it('draws each filled pixel in its colour and leaves empty pixels out', () => {
    const svg = toSvg(TINY, 'golden')

    expect(svg).toContain('<rect x="0" y="0" width="1" height="1" fill="#4a2a10"/>')
    expect(svg).toContain('<rect x="1" y="0" width="1" height="1" fill="#e9a640"/>')
    expect(svg).toContain('<rect x="1" y="1" width="1" height="1" fill="#1a120c"/>')
    expect(svg.match(/<rect /g)).toHaveLength(3)
  })

  it('merges a run of one colour in a row into one rect', () => {
    const svg = toSvg({ ...TINY, pixels: ['ccc.c', '.....'] }, 'golden')

    expect(svg).toContain('<rect x="0" y="0" width="3" height="1" fill="#e9a640"/>')
    expect(svg).toContain('<rect x="4" y="0" width="1" height="1" fill="#e9a640"/>')
    expect(svg.match(/<rect /g)).toHaveLength(2)
  })
})

describe('toHalfBlocks', () => {
  const GOLDEN_O = 0x4a2a10
  const GOLDEN_C = 0xe9a640
  const EYE = 0x1a120c

  it('folds two pixel rows into one text row', () => {
    const rows = toHalfBlocks(TINY, 'golden')

    expect(rows).toHaveLength(1)
    expect(rows[0]).toHaveLength(2)
  })

  it('draws an upper pixel alone as an upper half block on the default background', () => {
    const rows = toHalfBlocks(TINY, 'golden')

    expect(rows[0]![0]).toEqual({ glyph: '▀', fg: GOLDEN_O, bg: null })
  })

  it('draws two pixels as an upper half block over the lower colour', () => {
    const rows = toHalfBlocks(TINY, 'golden')

    expect(rows[0]![1]).toEqual({ glyph: '▀', fg: GOLDEN_C, bg: EYE })
  })

  it('draws a lower pixel alone as a lower half block', () => {
    const rows = toHalfBlocks({ ...TINY, pixels: ['.', 'c'] }, 'golden')

    expect(rows[0]![0]).toEqual({ glyph: '▄', fg: GOLDEN_C, bg: null })
  })

  it('draws two pixels of one colour as a full block', () => {
    const rows = toHalfBlocks({ ...TINY, pixels: ['c', 'c'] }, 'golden')

    expect(rows[0]![0]).toEqual({ glyph: '█', fg: GOLDEN_C, bg: null })
  })

  it('draws two empty pixels as a space', () => {
    const rows = toHalfBlocks({ ...TINY, pixels: ['.', '.'] }, 'golden')

    expect(rows[0]![0]).toEqual({ glyph: ' ', fg: null, bg: null })
  })

  it('treats a missing last pixel row as empty', () => {
    const rows = toHalfBlocks({ ...TINY, pixels: ['oc', '.e', 'c.'] }, 'golden')

    expect(rows).toHaveLength(2)
    expect(rows[1]).toEqual([
      { glyph: '▀', fg: GOLDEN_C, bg: null },
      { glyph: ' ', fg: null, bg: null },
    ])
  })
})
