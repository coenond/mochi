// The engine shell (ADR-0005): turns the core's sprites into what each surface draws in
// the band, the owner's `/pet` commands and coat pick into a kept pet, and the clock into
// the pet's idle life. No pet logic lives here.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderInput, UiBlitResult } from 'claude-code'

import type { CoatPick, IdlePose, TerminalDrawsImages } from '../types'
import { petCommand, storedPet, type Pet } from '../src/core/adoption'
import { toBase64 } from '../src/core/base64'
import {
  nextSpell,
  poseAt,
  seededRandom,
  spellEndsAt,
  type Random,
  type Spell,
} from '../src/core/idle'
import {
  BASKET,
  FALLBACK_BASKET,
  FALLBACK_IDLE,
  FALLBACK_SIT,
  PET_IDLE,
  PET_SIT,
} from '../src/core/sheet'
import {
  COATS,
  mirror,
  toHalfBlocks,
  toRgba,
  toSvg,
  type Coat,
  type HalfBlockCell,
  type Sprite,
} from '../src/core/sprites'

/** The pet's key in the cross-session store, shared by every project and session. */
const STORE_KEY = 'pet'

/** The band is 3 text rows; a 32 by 24 picture fills 8 columns of them. */
const BAND_ROWS = 3
const PICTURE_COLUMNS = 8
/** The half-block fallback is 24 pixels wide, a column each. */
const FALLBACK_COLUMNS = 24
/** CSS pixels on the remote surfaces: 2 per sprite pixel. */
const SVG_SCALE = 2

/** How long after drawing to ask the engine whether the image shows, and how often. */
const PROBE_DELAY_MS = 300
const PROBE_ATTEMPTS = 5

const BASKET_HINT = '/pet adopt to adopt a pup'
const COAT_KEY_PREFIX = 'coat:'

/** What the band shows: its key, the picture, its half-block fallback and its alt. */
type Picture = { key: string; sprite: Sprite; fallback: Sprite; coat: Coat; alt: string }

const terminalDrawsImages = atom(
  { plugin: 'mochi', key: 'terminalDrawsImages' } as const,
  null as TerminalDrawsImages,
)
// Change a tag when its value's fields change: it declines what an earlier version kept.
const pet = atom({ plugin: 'mochi', key: 'pet' } as const, null as Pet | null, {
  shape: 'pet-1',
})
const coatPick = atom({ plugin: 'mochi', key: 'coatPick' } as const, null as CoatPick, {
  shape: 'coat-pick-1',
})
const STILL: IdlePose = { behaviour: 'sit', frame: 0, x: 0, facing: 'right' }
const idlePose = atom({ plugin: 'mochi', key: 'idlePose' } as const, STILL, {
  shape: 'idle-pose-1',
})

/** Whether this session's image probe runs, and the picture last drawn, which it blits. */
type Probe = { isRunning: boolean; shown: Picture | undefined }

/**
 * This session's idle life: the spell playing, the columns the pet can move in (the band
 * says at each drawing), and the pose last written. A reload starts it over.
 */
type Life = {
  isRunning: boolean
  spell: Spell | null
  room: number
  random: Random | null
  shown: IdlePose | null
}

export const register: Register = on => {
  const probe: Probe = { isRunning: false, shown: undefined }
  const life: Life = { isRunning: false, spell: null, room: 0, random: null, shown: null }

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'pet',
      description: 'Adopt and name your pup',
      argumentHint: 'adopt <name> [coat] | name <name>',
      immediate: true,
    })
    const kept = storedPet(await $.store.get(STORE_KEY))
    await update($, pet, () => kept)
    if (kept !== null) live($, life)

    return next(e)
  })

  on('command.run', { command: 'pet' }, async ($, e) => {
    // Read the store, not this session's copy: another session may have changed the pet.
    const current = storedPet(await $.store.get(STORE_KEY))
    await update($, pet, () => current)
    const outcome = petCommand(e.args, current)

    if (outcome.kind === 'adopted' || outcome.kind === 'renamed') {
      await keep($, life, outcome.pet)
    } else if (outcome.kind === 'pickCoat') {
      await update($, coatPick, () => ({ name: outcome.name, coat: COATS[0]! }))
    }

    return { text: outcome.reply, isTextDisplayOnly: true }
  })

  // The pup shows the coat the focus is on, so the owner sees each shade before picking.
  on('ui.focus', { component: 'AbovePrompt' }, async ($, e, next) => {
    const moved = await next(e)
    const coat = COATS.find(one => e.element === COAT_KEY_PREFIX + one)
    if (moved.deny === undefined && coat !== undefined) {
      await update($, coatPick, pick => (pick === null ? null : { ...pick, coat })).catch(
        () => undefined,
      )
    }

    return moved
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)

    const { Box, Button, Text } = $.ui.resolve(e)
    const adopted = await read($, pet)
    if (adopted !== null) {
      const pose = await read($, idlePose)
      const isFallback =
        e.surface === 'terminal' && (await read($, terminalDrawsImages)) === false
      life.room = e.props.bodyColumns - (isFallback ? FALLBACK_COLUMNS : PICTURE_COLUMNS)
      return (
        <Box marginLeft={Math.max(0, Math.min(pose.x, life.room))}>
          {await drawPicture($, e, probe, idlePicture(adopted, pose))}
        </Box>
      )
    }

    const pick = await read($, coatPick)
    if (pick !== null) {
      return (
        <Box flexDirection="row" alignItems="center" columnGap={1}>
          {await drawPicture($, e, probe, petPicture(pick.coat, pick.name))}
          <Text dimColor>{pick.name}'s coat:</Text>
          {COATS.map((coat, i) => (
            <Button
              key={COAT_KEY_PREFIX + coat}
              label={coat}
              hotkey={coat[0]}
              autoFocus={i === 0 ? true : undefined}
              onPress={() => keep($, life, { name: pick.name, coat })}
            />
          ))}
        </Box>
      )
    }

    return (
      <Box flexDirection="row" alignItems="center" columnGap={1}>
        {await drawPicture($, e, probe, BASKET_PICTURE)}
        <Text dimColor>{BASKET_HINT}</Text>
      </Box>
    )
  })
}

/**
 * The picture as this surface draws it: an SVG on the remote surfaces, an image in a
 * terminal that shows one, half-blocks in any other terminal (ADR-0007).
 */
async function drawPicture(
  $: EngineInterface,
  e: RenderInput<'AbovePrompt'>,
  probe: Probe,
  picture: Picture,
) {
  probe.shown = picture
  const { key, sprite, fallback, coat, alt } = picture

  if (e.surface !== 'terminal') {
    const { Svg } = $.ui.resolve(e)
    return (
      <Svg
        source={toSvg(sprite, coat)}
        alt={alt}
        width={sprite.pixels[0]!.length * SVG_SCALE}
        height={sprite.pixels.length * SVG_SCALE}
      />
    )
  }

  const { Image, Raster } = $.ui.resolve(e)
  const drawsImages = await read($, terminalDrawsImages)

  if (drawsImages === false) {
    const rows = toHalfBlocks(fallback, coat)
    return (
      <Raster
        key={key}
        columns={rows[0]!.length}
        rows={rows.length}
        cells={packCells(rows)}
      />
    )
  }

  if (drawsImages === null && !probe.isRunning) {
    probe.isRunning = true
    $.clock.after(PROBE_DELAY_MS, async () => {
      for (let attempt = 1; attempt <= PROBE_ATTEMPTS; attempt++) {
        const now = probe.shown ?? picture
        const result = await $.ui.blit({
          requestId: e.requestId,
          key: now.key,
          source: imageSource(now),
        })
        if (await settleProbe($, result)) break
        await $.clock.sleep(PROBE_DELAY_MS)
      }
      probe.isRunning = false
    })
  }

  return (
    <Image
      key={key}
      source={imageSource(picture)}
      columns={PICTURE_COLUMNS}
      rows={BAND_ROWS}
      alt={alt}
    />
  )
}

const BASKET_PICTURE: Picture = {
  key: 'basket',
  sprite: BASKET,
  fallback: FALLBACK_BASKET,
  coat: COATS[0]!,
  alt: 'An empty dog basket',
}

function petPicture(coat: Coat, name: string): Picture {
  return { key: 'pet', sprite: PET_SIT, fallback: FALLBACK_SIT, coat, alt: name }
}

/** The pet in its idle pose. The fallback faces the owner, so only real pixels turn. */
function idlePicture(
  { coat, name }: Pet,
  { behaviour, frame, facing }: IdlePose,
): Picture {
  const frames = PET_IDLE[behaviour]
  const fallbacks = FALLBACK_IDLE[behaviour]
  const sprite = frames[frame % frames.length]!
  return {
    key: 'pet',
    sprite: facing === 'left' ? turned(sprite) : sprite,
    fallback: fallbacks[frame % fallbacks.length]!,
    coat,
    alt: name,
  }
}

const TURNED = new WeakMap<Sprite, Sprite>()

function turned(sprite: Sprite): Sprite {
  let left = TURNED.get(sprite)
  if (left === undefined) {
    left = mirror(sprite)
    TURNED.set(sprite, left)
  }
  return left
}

/** Keeps the pet in the store for every session, and in this one's band. */
async function keep($: EngineInterface, life: Life, kept: Pet) {
  await $.store.set(STORE_KEY, kept)
  await update($, pet, () => kept)
  await update($, coatPick, () => null)
  live($, life)
}

/** Starts the idle life on the clock, once per session. */
function live($: EngineInterface, life: Life) {
  if (life.isRunning) return
  life.isRunning = true
  void tick($, life)
}

/**
 * Draws the pose for now and waits for the next: a frame later while the pet moves, the
 * spell's end while it holds still, so a still pet costs no redraws at all.
 */
async function tick($: EngineInterface, life: Life) {
  try {
    const now = await $.clock.now()
    // Seeded from the clock: a session's idle life replays under a test's clock.
    life.random ??= seededRandom(now)
    if (life.spell === null || now >= spellEndsAt(life.spell)) {
      life.spell = nextSpell(life.spell, now, life.room, life.random)
    }
    const { behaviour, frame, x, facing, nextAt } = poseAt(life.spell, now)
    const pose: IdlePose = { behaviour, frame, x, facing }
    if (!isSamePose(life.shown, pose)) {
      await update($, idlePose, () => pose)
      life.shown = pose
    }
    $.clock.after(Math.max(1, nextAt - now), () => tick($, life))
  } catch {
    life.isRunning = false
  }
}

function isSamePose(a: IdlePose | null, b: IdlePose): boolean {
  return (
    a !== null &&
    a.behaviour === b.behaviour &&
    a.frame === b.frame &&
    a.x === b.x &&
    a.facing === b.facing
  )
}

function imageSource({ sprite, coat }: Picture) {
  const { rgba, width, height } = toRgba(sprite, coat)
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
