import { describe, expect, it } from 'vitest'

import { toBase64 } from './base64'

describe('toBase64', () => {
  it.each([
    ['', ''],
    ['f', 'Zg=='],
    ['fo', 'Zm8='],
    ['foo', 'Zm9v'],
    ['foobar', 'Zm9vYmFy'],
  ])('encodes %j as standard padded base64', (text, expected) => {
    expect(toBase64(Uint8Array.from(text, ch => ch.charCodeAt(0)))).toBe(expected)
  })

  it('uses + and / for the last two digits', () => {
    const bytes = Uint8Array.of(0xff, 0xff, 0xff, 0xfb, 0xef, 0xbe, 0x00, 0xff, 0x80)

    expect(toBase64(bytes)).toBe('////++++AP+A')
  })
})
