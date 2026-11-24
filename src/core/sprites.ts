// Turns a sprite (a grid of palette letters) and a coat into what a surface can draw:
// an SVG for the desktop app, VS Code and mobile, RGBA pixels for terminals that show
// images, and half-block cells for every other terminal (ADR-0007).

export type Coat = 'golden' | 'light' | 'red'

export const COATS: readonly Coat[] = ['golden', 'light', 'red']

/** Colours as `#rrggbb`, by palette letter. */
export type Colours = Readonly<Record<string, string>>

export type Palette = {
  /** Letters whose colour depends on the coat, such as outline and coat. */
  coats: Readonly<Record<Coat, Colours>>
  /** Letters with one colour for every coat, such as eyes and nose. */
  fixed: Colours
}

/** One frame of pixel art: rows of palette letters, `.` for an empty pixel. */
export type Sprite = {
  pixels: readonly string[]
  palette: Palette
}

export type RgbaImage = { rgba: Uint8Array; width: number; height: number }

/** One terminal cell: a glyph and its colours as `0xRRGGBB`, `null` for the default. */
export type HalfBlockCell = { glyph: string; fg: number | null; bg: number | null }

const EMPTY = '.'

export function toRgba(sprite: Sprite, coat: Coat): RgbaImage {
  const grid = colourGrid(sprite, coat)
  const width = widthOf(sprite)
  const height = grid.length
  const rgba = new Uint8Array(width * height * 4)

  grid.forEach((row, y) =>
    row.forEach((colour, x) => {
      if (colour === null) return
      const i = (y * width + x) * 4
      rgba[i] = (colour >> 16) & 0xff
      rgba[i + 1] = (colour >> 8) & 0xff
      rgba[i + 2] = colour & 0xff
      rgba[i + 3] = 0xff
    }),
  )

  return { rgba, width, height }
}

export function toSvg(sprite: Sprite, coat: Coat): string {
  const grid = colourGrid(sprite, coat)
  const width = widthOf(sprite)
  const rects: string[] = []

  grid.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      const colour = row[x]
      let end = x + 1
      while (end < row.length && row[end] === colour) end++
      if (colour !== null && colour !== undefined) {
        rects.push(
          `<rect x="${x}" y="${y}" width="${end - x}" height="1" fill="${toHex(colour)}"/>`,
        )
      }
      x = end
    }
  })

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${grid.length}" ` +
    `shape-rendering="crispEdges">${rects.join('')}</svg>`
  )
}

export function toHalfBlocks(sprite: Sprite, coat: Coat): HalfBlockCell[][] {
  const grid = colourGrid(sprite, coat)
  const width = widthOf(sprite)
  const rows: HalfBlockCell[][] = []

  for (let y = 0; y < grid.length; y += 2) {
    const row: HalfBlockCell[] = []
    for (let x = 0; x < width; x++) {
      row.push(halfBlock(grid[y]?.[x] ?? null, grid[y + 1]?.[x] ?? null))
    }
    rows.push(row)
  }

  return rows
}

function halfBlock(top: number | null, bottom: number | null): HalfBlockCell {
  if (top === null && bottom === null) return { glyph: ' ', fg: null, bg: null }
  if (top === null) return { glyph: '▄', fg: bottom, bg: null }
  if (top === bottom) return { glyph: '█', fg: top, bg: null }
  return { glyph: '▀', fg: top, bg: bottom }
}

function colourGrid(sprite: Sprite, coat: Coat): (number | null)[][] {
  const coatColours = sprite.palette.coats[coat]
  const width = widthOf(sprite)

  return sprite.pixels.map(row =>
    Array.from({ length: width }, (_, x) => {
      const letter = row[x] ?? EMPTY
      if (letter === EMPTY) return null
      const hex = coatColours[letter] ?? sprite.palette.fixed[letter]
      if (hex === undefined) throw new Error(`No colour for pixel "${letter}"`)
      return parseInt(hex.slice(1), 16)
    }),
  )
}

function widthOf(sprite: Sprite): number {
  return Math.max(0, ...sprite.pixels.map(row => row.length))
}

function toHex(colour: number): string {
  return `#${colour.toString(16).padStart(6, '0')}`
}
