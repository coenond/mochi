// The engine shell (ADR-0005): turns the core's sprites into what each surface draws in
// the band. No pet logic lives here.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, UiBlitResult } from 'claude-code'

import type { TerminalDrawsImages } from '../types'
import { toBase64 } from '../src/core/base64'
import { FALLBACK_SIT, PET_SIT } from '../src/core/sheet'
import {
  toHalfBlocks,
  toRgba,
  toSvg,
  type Coat,
  type HalfBlockCell,
} from '../src/core/sprites'

const PET_KEY = 'pet'
const ALT = 'Mochi'

/** The band is 3 text rows; the 32 by 24 pet fills 8 columns of them. */
const BAND_ROWS = 3
const PET_COLUMNS = 8
/** CSS pixels on the remote surfaces: 2 per sprite pixel. */
const SVG_SCALE = 2

/** How long after drawing to ask the engine whether the image shows, and how often. */
const PROBE_DELAY_MS = 300
const PROBE_ATTEMPTS = 5

// Until adoption (ticket #3) every pet is golden.
const COAT: Coat = 'golden'

const terminalDrawsImages = atom(
  { plugin: 'mochi', key: 'terminalDrawsImages' } as const,
  null as TerminalDrawsImages,
)

export const register: Register = on => {
  let isProbing = false

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)

    if (e.surface !== 'terminal') {
      const { Svg } = $.ui.resolve(e)
      return (
        <Svg
          source={toSvg(PET_SIT, COAT)}
          alt={ALT}
          width={PET_SIT.pixels[0]!.length * SVG_SCALE}
          height={PET_SIT.pixels.length * SVG_SCALE}
        />
      )
    }

    const { Image, Raster } = $.ui.resolve(e)
    const drawsImages = await read($, terminalDrawsImages)

    if (drawsImages === false) {
      const rows = toHalfBlocks(FALLBACK_SIT, COAT)
      return (
        <Raster
          key={PET_KEY}
          columns={rows[0]!.length}
          rows={rows.length}
          cells={packCells(rows)}
        />
      )
    }

    const source = petImageSource()
    if (drawsImages === null && !isProbing) {
      isProbing = true
      $.clock.after(PROBE_DELAY_MS, async () => {
        for (let attempt = 1; attempt <= PROBE_ATTEMPTS; attempt++) {
          const result = await $.ui.blit({ requestId: e.requestId, key: PET_KEY, source })
          if (await settleProbe($, result)) break
          await $.clock.sleep(PROBE_DELAY_MS)
        }
        isProbing = false
      })
    }

    return (
      <Image
        key={PET_KEY}
        source={source}
        columns={PET_COLUMNS}
        rows={BAND_ROWS}
        alt={ALT}
      />
    )
  })
}

function petImageSource() {
  const { rgba, width, height } = toRgba(PET_SIT, COAT)
  return { rgba: toBase64(rgba), width, height }
}

/**
 * The engine refuses a blit to an Image that draws its alt, which is how a terminal
 * without image support shows itself. Any other refusal (nothing mounted yet, no
 * surface) proves nothing, so the probe tries again. Resolves whether it settled.
 */
async function settleProbe($: EngineInterface, result: UiBlitResult): Promise<boolean> {
  if (result.deny === undefined) {
    await update($, terminalDrawsImages, () => true)
    return true
  }
  if (/\balt\b/.test(result.deny)) {
    await update($, terminalDrawsImages, () => false)
    return true
  }
  return false
}

/** Raster cells: little-endian u32 triplets `[codePoint, fg, bg]`, base64. */
function packCells(rows: HalfBlockCell[][]): string {
  const DEFAULT = 0x01000000
  const words = new Uint32Array(rows.length * (rows[0]?.length ?? 0) * 3)
  let i = 0
  for (const row of rows) {
    for (const cell of row) {
      words[i++] = cell.glyph.codePointAt(0)!
      words[i++] = cell.fg ?? DEFAULT
      words[i++] = cell.bg ?? DEFAULT
    }
  }
  return toBase64(new Uint8Array(words.buffer))
}
