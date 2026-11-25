import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type {
  On,
  PromptChangeInput,
  PromptEditInput,
  PromptEditResult,
  PromptSubmitInput,
  TurnCompleteInput,
  TurnStartInput,
  UiFocusInput,
} from 'claude-code'

import { PET_FRAMES } from '../src/core/sheet'
import { mirror, toSvg } from '../src/core/sprites'

const MOCHI = { name: 'Mochi', coat: 'red' }

const BAND = {
  plugin: 'mochi',
  component: 'AbovePrompt',
  requestId: 'band',
  props: {
    hasSurvey: false,
    isCollapsed: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  },
} as const

/**
 * Stands in for the engine beneath the mod, with the cross-session store as a map the
 * test reads and writes, and starts a session over what the store holds.
 */
async function startSession($: Engine, on: On, stored: Record<string, unknown> = {}) {
  const store = new Map(Object.entries(stored))
  on('store.get', (_, e) => ({ value: store.get(e.key) }))
  on('store.set', (_, e) => {
    store.set(e.key, e.value)
    return { value: undefined }
  })
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  return store
}

/** The owner typing `/pet <args>` at the prompt. */
function runPet($: Engine, args: string) {
  return $.command.run({
    command: 'pet',
    args,
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 80 },
  })
}

test('the desktop app, VS Code and mobile draw the pet as an SVG', async ($, on) => {
  await startSession($, on, { pet: MOCHI })
  for (const surface of ['desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })

    const pet = await ui.find({ type: 'Svg' })
    expect(pet?.props.alt).toBe('Mochi')
    expect(pet?.props.source).toMatch(/^<svg [^>]*viewBox="0 0 32 24"/)
    await ui.unmount()
  }
})

test('the terminal draws the pet as a 3-row image at first', async ($, on) => {
  await startSession($, on, { pet: MOCHI })
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })

  const pet = await ui.find({ type: 'Image', key: 'pet' })
  expect(pet?.props.rows).toBe(3)
  expect(pet?.props.source).toMatchObject({ width: 32, height: 24 })
  await ui.unmount()
})

test('a terminal that shows the alt in place of the image gets the half-block fallback', async ($, on) => {
  const clock = mock.clock(on)
  on('ui.blit', () => ({ value: { deny: 'the Image draws its alt there' } }))
  await startSession($, on, { pet: MOCHI })

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await clock.advance(300)

  const pet = await ui.find({ type: 'Raster', key: 'pet' })
  expect(pet?.props).toMatchObject({ columns: 24, rows: 5 })
  expect(await ui.find({ type: 'Image' })).toBeUndefined()
  await ui.unmount()
})

test('a terminal that takes the image keeps it', async ($, on) => {
  const clock = mock.clock(on)
  on('ui.blit', () => ({ value: {} }))
  await startSession($, on, { pet: MOCHI })

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await clock.advance(300)

  expect(await ui.find({ type: 'Image', key: 'pet' })).toBeDefined()
  await ui.unmount()
})

test('a probe refused for another reason tries again', async ($, on) => {
  const clock = mock.clock(on)
  const answers = [{ deny: 'nothing of this plugin is mounted there' }, {}]
  on('ui.blit', () => ({ value: answers.shift() ?? {} }))
  await startSession($, on, { pet: MOCHI })

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await clock.advance(300)
  await clock.advance(300)

  expect(answers).toHaveLength(0)
  expect(await ui.find({ type: 'Image', key: 'pet' })).toBeDefined()
  await ui.unmount()
})

test('the pet yields the band to a survey', async ($, on) => {
  await startSession($, on, { pet: MOCHI })
  const ui = await $.ui.mount({
    ...BAND,
    surface: 'terminal',
    props: { ...BAND.props, hasSurvey: true },
  })

  expect(await ui.find({ key: 'pet' })).toBeUndefined()
  await ui.unmount()
})

test('with no pet the band shows the basket and the adoption hint', async ($, on) => {
  mock.clock(on)
  await startSession($, on)

  for (const [surface, type] of [
    ['terminal', 'Image'],
    ['desktop', 'Svg'],
  ] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })

    expect((await ui.find({ type }))?.props.alt).toBe('An empty dog basket')
    expect((await ui.find({ type: 'Text', text: /adopt/ }))?.text).toBe(
      '/pet adopt to adopt a pup',
    )
    await ui.unmount()
  }
})

test('a plain terminal gets the half-block basket', async ($, on) => {
  const clock = mock.clock(on)
  on('ui.blit', () => ({ value: { deny: 'the Image draws its alt there' } }))
  await startSession($, on)

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await clock.advance(300)

  const basket = await ui.find({ type: 'Raster', key: 'basket' })
  expect(basket?.props).toMatchObject({ columns: 24, rows: 5 })
  await ui.unmount()
})

test('/pet adopt with a coat adopts and keeps the pet in the store', async ($, on) => {
  mock.clock(on)
  const store = await startSession($, on)

  const { text } = await runPet($, 'adopt Mochi light')

  expect(text).toBe('Mochi is home.')
  expect(store.get('pet')).toEqual({ name: 'Mochi', coat: 'light' })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await ui.find({ type: 'Svg' }))?.props.alt).toBe('Mochi')
  expect(await ui.find({ type: 'Text', text: /adopt/ })).toBeUndefined()
  await ui.unmount()
})

test('a pet adopted in another session or project is there at the start', async ($, on) => {
  await startSession($, on, { pet: MOCHI })

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const pet = await ui.find({ type: 'Svg' })
  expect(pet?.props).toMatchObject({
    alt: 'Mochi',
    source: expect.stringContaining('#c9722c'),
  })
  await ui.unmount()
})

test('/pet adopt without a coat lets the owner pick one in the band', async ($, on) => {
  mock.clock(on)
  const store = await startSession($, on)

  const { text } = await runPet($, 'adopt Mochi')
  expect(text).toBe("Pick Mochi's coat in the band (ctrl+x tab to reach it).")
  expect(store.get('pet')).toBeUndefined()

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const coats = await ui.findAll({ type: 'Button' })
  expect(coats.map(coat => coat.props.hotkey)).toEqual(['g', 'l', 'r'])
  await ui.press({ key: 'coat:red' })

  expect(store.get('pet')).toEqual({ name: 'Mochi', coat: 'red' })
  expect(await ui.find({ key: 'coat:red' })).toBeUndefined()
  expect(await ui.find({ key: 'pet' })).toBeDefined()
  await ui.unmount()
})

test('the coat with focus shows on the pup before it is picked', async ($, on) => {
  mock.clock(on)
  on('ui.focus', () => ({}))
  await startSession($, on)
  await runPet($, 'adopt Mochi')
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })

  // The owner tabbing onto a coat: the event as the engine raises it, not the call.
  const tab: UiFocusInput = {
    component: 'AbovePrompt',
    requestId: 'band',
    element: 'coat:red',
    origin: { kind: 'person' },
  }
  await $.ui.focus(tab as never)

  const pup = await ui.find({ type: 'Svg' })
  expect(pup?.props.source).toContain('#c9722c')
  await ui.unmount()
})

test('/pet name renames the pet everywhere', async ($, on) => {
  mock.clock(on)
  const store = await startSession($, on, { pet: MOCHI })

  const { text } = await runPet($, 'name Biscuit')

  expect(text).toBe('Mochi is now called Biscuit.')
  expect(store.get('pet')).toEqual({ name: 'Biscuit', coat: 'red' })
})

test('/pet adopt sees a pet another session adopted since this one started', async ($, on) => {
  mock.clock(on)
  const store = await startSession($, on)
  store.set('pet', MOCHI)

  const { text } = await runPet($, 'adopt Biscuit golden')

  expect(text).toBe('Mochi is already home. Rename with /pet name <name>.')
  expect(store.get('pet')).toEqual(MOCHI)
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await ui.find({ type: 'Svg' }))?.props.alt).toBe('Mochi')
  await ui.unmount()
})

/** Watches the band on the desktop app for `ms`, a frame at a time: x and picture. */
async function watchBand($: Engine, on: On, ms: number, bodyColumns = 80) {
  const clock = mock.clock(on)
  await startSession($, on, { pet: MOCHI })
  const ui = await $.ui.mount({
    ...BAND,
    surface: 'desktop',
    props: { ...BAND.props, bodyColumns },
  })
  const seen: { x: number; source: string }[] = []
  for (let t = 0; t < ms; t += 160) {
    const box = await ui.find({ key: 'pet:spot' })
    const pet = await ui.find({ type: 'Svg' })
    seen.push({
      x: Number(box?.props.marginLeft ?? 0),
      source: String(pet?.props.source),
    })
    await clock.advance(160)
  }
  await ui.unmount()
  return seen
}

test('the pet walks about the band on its own', async ($, on) => {
  const seen = await watchBand($, on, 10 * 60_000)

  const spots = new Set(seen.map(one => one.x))
  expect(spots.size).toBeGreaterThan(10)
  expect(Math.max(...spots)).toBeLessThanOrEqual(80 - 8)
})

test('between spells the pet holds still, with nothing to redraw', async ($, on) => {
  const seen = await watchBand($, on, 10 * 60_000)

  let still = 0
  let longest = 0
  for (let i = 1; i < seen.length; i++) {
    const same = seen[i]!.x === seen[i - 1]!.x && seen[i]!.source === seen[i - 1]!.source
    still = same ? still + 1 : 0
    longest = Math.max(longest, still)
  }
  expect(longest * 160).toBeGreaterThan(10_000)
})

test('in a band narrower than the pet it stays at the left edge', async ($, on) => {
  const seen = await watchBand($, on, 3 * 60_000, 6)

  expect(new Set(seen.map(one => one.x))).toEqual(new Set([0]))
})

const HOUR = 3_600_000

/** Needs as the store keeps them, true at `at`. */
function needs(
  at: number,
  levels: Partial<Record<'hunger' | 'happiness' | 'energy', number>>,
) {
  return { hunger: 100, happiness: 100, energy: 100, ...levels, at }
}

test('adopting gives the pet full needs, kept in the store', async ($, on) => {
  const clock = mock.clock(on)
  const store = await startSession($, on)
  const now = clock.now()

  await runPet($, 'adopt Mochi red')

  expect(store.get('needs')).toEqual(needs(now, {}))
})

test('/pet feed gives a hungry pet kibble, and it eats', async ($, on) => {
  const clock = mock.clock(on)
  const now = clock.now()
  const store = await startSession($, on, {
    pet: MOCHI,
    needs: needs(now, { hunger: 20 }),
  })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })

  const { text } = await runPet($, 'feed')

  expect(text).toBe('Mochi crunches through the kibble.')
  expect(store.get('needs')).toMatchObject({ hunger: 50 })
  // The eating frames bring their own red bowl heaped with kibble.
  expect((await ui.find({ type: 'Svg' }))?.props.source).toContain('#d4553f')
  await ui.unmount()
})

test('a full pet refuses kibble', async ($, on) => {
  const clock = mock.clock(on)
  const store = await startSession($, on, { pet: MOCHI, needs: needs(clock.now(), {}) })

  const { text } = await runPet($, 'feed')

  expect(text).toBe('Mochi is full.')
  expect(store.get('needs')).toMatchObject({ hunger: 100 })
})

test('/pet status shows name, coat, needs and treats saved', async ($, on) => {
  const clock = mock.clock(on)
  await startSession($, on, {
    pet: MOCHI,
    needs: needs(clock.now(), { hunger: 40, happiness: 80, energy: 60 }),
  })

  const { text } = await runPet($, 'status')

  expect(text).toBe(
    'Mochi, red coat. Hunger 40, happiness 80, energy 60. Treats saved: 0.',
  )
})

test('needs drift while Claude Code was closed, the pet asleep meanwhile', async ($, on) => {
  const clock = mock.clock(on)
  const store = await startSession($, on, {
    pet: MOCHI,
    needs: needs(clock.now() - 8 * HOUR, { energy: 10 }),
  })
  await clock.advance(1)

  expect(store.get('needs')).toMatchObject({ hunger: 0, energy: 100 })
})

test('a hungry pet sits by its empty bowl now and then', async ($, on) => {
  const clock = mock.clock(on)
  await startSession($, on, { pet: MOCHI, needs: needs(clock.now(), { hunger: 5 }) })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })

  let sawBowl = false
  for (let t = 0; t < 10 * 60_000 && !sawBowl; t += 1000) {
    const pictures = await ui.findAll({ type: 'Svg' })
    sawBowl = pictures.some(one => one.props.alt === 'An empty bowl')
    await clock.advance(1000)
  }

  expect(sawBowl).toBe(true)
  await ui.unmount()
})

test('/pet pet makes the pet happier, and it is petted', async ($, on) => {
  const clock = mock.clock(on)
  const store = await startSession($, on, {
    pet: MOCHI,
    needs: needs(clock.now(), { happiness: 50 }),
  })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const before = (await ui.find({ type: 'Svg' }))?.props.source

  const { text } = await runPet($, 'pet')

  expect(text).toBe('Mochi leans into your hand.')
  expect(store.get('needs')).toMatchObject({ happiness: 60 })
  expect((await ui.find({ type: 'Svg' }))?.props.source).not.toBe(before)
  await ui.unmount()
})

const TRICK_SVGS = (['spin', 'rollOver', 'playBow', 'hop'] as const).flatMap(trick =>
  PET_FRAMES[trick].flatMap((_, i) => svgsOf(trick, i)),
)

test('/pet treat gives a saved treat: much happier, and a trick', async ($, on) => {
  const clock = mock.clock(on)
  const store = await startSession($, on, {
    pet: MOCHI,
    needs: needs(clock.now(), { happiness: 50 }),
    treats: 2,
  })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })

  const { text } = await runPet($, 'treat')
  await clock.advance(1)

  expect(text).toBe('Mochi gobbles the treat and does a trick.')
  expect(store.get('needs')).toMatchObject({ happiness: 80 })
  expect(store.get('treats')).toBe(1)
  expect(TRICK_SVGS).toContain(await petSource(ui))
  await ui.unmount()
})

test('with no treats saved, nothing is given', async ($, on) => {
  const clock = mock.clock(on)
  const store = await startSession($, on, {
    pet: MOCHI,
    needs: needs(clock.now(), { happiness: 50 }),
  })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const before = await petSource(ui)

  const { text } = await runPet($, 'treat')
  await clock.advance(1)

  expect(text).toBe('No treats saved. Mochi earns them with wins.')
  expect(store.get('needs')).toMatchObject({ happiness: 50 })
  expect(await petSource(ui)).toBe(before)
  await ui.unmount()
})

test('the band has dim ♥, ∴ and ✦ controls on hotkeys p, f and t (ADR-0008)', async ($, on) => {
  const clock = mock.clock(on)
  await startSession($, on, { pet: MOCHI, needs: needs(clock.now(), {}) })

  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    const controls = await ui.findAll({ type: 'Button' })

    expect(controls.map(one => [one.props.label, one.props.hotkey])).toEqual([
      ['♥', 'p'],
      ['∴', 'f'],
      ['✦', 't'],
    ])
    expect(controls.every(one => one.props.dimColor === true)).toBe(true)
    await ui.unmount()
  }
})

test('the controls stand in a column at the right edge, wherever the pet is', async ($, on) => {
  const clock = mock.clock(on)
  await startSession($, on, { pet: MOCHI, needs: needs(clock.now(), {}) })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    const controls = await ui.find({ key: 'care' })
    const spot = await ui.find({ key: 'pet:spot' })

    expect(controls?.props).toMatchObject({ flexDirection: 'column' })
    expect(controls?.props.marginLeft).toBeUndefined()
    // The pet's spot takes the band's width, which pushes the controls to its edge.
    expect(spot?.props.flexGrow).toBe(1)
    await ui.unmount()
  }
})

test('pressing a control pets, feeds or gives a treat without a word', async ($, on) => {
  const clock = mock.clock(on)
  const appended = mock.session(on)
  const store = await startSession($, on, {
    pet: MOCHI,
    needs: needs(clock.now(), { hunger: 20, happiness: 50 }),
    treats: 1,
  })
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })

  await ui.press({ key: 'care:pet' })
  await ui.press({ key: 'care:feed' })
  await ui.press({ key: 'care:treat' })

  expect(store.get('needs')).toMatchObject({ hunger: 50, happiness: 90 })
  expect(store.get('treats')).toBe(0)
  expect(appended.appended()).toEqual([])
  await ui.unmount()
})

test('the basket and the coat pick have no care controls', async ($, on) => {
  mock.clock(on)
  await startSession($, on)
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })

  expect(await ui.find({ key: 'care:pet' })).toBeUndefined()
  await ui.unmount()
})

/** The curious frames as the desktop app draws them, facing either way. */
function curiousSvgs(frame: number): string[] {
  const sprite = PET_FRAMES.curious[frame]!
  return [toSvg(sprite, 'red'), toSvg(mirror(sprite), 'red')]
}

/** Stands in for the editor beneath the mod: the edit goes into the box. */
function editor(on: On) {
  on('prompt.edit', (_, e) => {
    const text = e.text.slice(0, e.start) + e.inputText + e.text.slice(e.end)
    return { text, cursor: e.start + e.inputText.length }
  })
  on('prompt.change', (_, e) => ({ text: e.text }))
}

/**
 * The prompt events as the engine raises them. The test kit carries them, but its types
 * list only the calls a plugin can make, so they are typed here once.
 */
function promptEvents($: Engine) {
  return $.prompt as unknown as {
    edit: (e: PromptEditInput) => Promise<PromptEditResult>
    change: (e: PromptChangeInput) => Promise<unknown>
    submit: (e: PromptSubmitInput) => Promise<unknown>
  }
}

/** The owner typing `typed` at the end of `draft`. */
function type($: Engine, draft: string, typed: string) {
  return promptEvents($).edit({
    origin: { kind: 'composer' },
    text: draft,
    cursor: draft.length,
    start: draft.length,
    end: draft.length,
    inputText: typed,
  })
}

async function petSource(ui: { find: (q: { type: string }) => Promise<unknown> }) {
  const pet = (await ui.find({ type: 'Svg' })) as
    { props: { source: string } } | undefined
  return pet?.props.source
}

test('when the owner types, the pet trots over and sits watching', async ($, on) => {
  const clock = mock.clock(on)
  editor(on)
  await startSession($, on, { pet: MOCHI, needs: needs(clock.now(), {}) })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })

  await type($, 'hello the', 're')
  await clock.advance(10 * 160)

  expect(curiousSvgs(0)).toContain(await petSource(ui))
  // The caret is at column 2 + 11; the 8-column pup sits centred over it.
  expect((await ui.find({ key: 'pet:spot' }))?.props.marginLeft).toBe(9)
  await ui.unmount()
})

test('its ears perk at a question mark', async ($, on) => {
  const clock = mock.clock(on)
  editor(on)
  await startSession($, on, { pet: MOCHI, needs: needs(clock.now(), {}) })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await type($, '', 'x')
  await clock.advance(5000)

  await type($, 'why', '?')

  expect(curiousSvgs(1)).toContain(await petSource(ui))
  await clock.advance(2000)
  expect(curiousSvgs(0)).toContain(await petSource(ui))
  await ui.unmount()
})

test('a while after the last key it wanders off again', async ($, on) => {
  const clock = mock.clock(on)
  editor(on)
  await startSession($, on, { pet: MOCHI, needs: needs(clock.now(), {}) })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await type($, '', 'x')
  await clock.advance(9000)
  expect(curiousSvgs(0)).toContain(await petSource(ui))

  await clock.advance(2000)

  const watching = [0, 1, 2, 3].flatMap(curiousSvgs)
  expect(watching).not.toContain(await petSource(ui))
  await ui.unmount()
})

test('sending or clearing the prompt sends it off at once', async ($, on) => {
  const clock = mock.clock(on)
  editor(on)
  await startSession($, on, { pet: MOCHI, needs: needs(clock.now(), {}) })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await type($, '', 'x')
  await clock.advance(3000)

  await promptEvents($).change({ text: '', cursor: 0, origin: { kind: 'clear' } })
  await clock.advance(1)

  expect([0, 1, 2, 3].flatMap(curiousSvgs)).not.toContain(await petSource(ui))
  await ui.unmount()
})

test('typing does not cut petting short', async ($, on) => {
  const clock = mock.clock(on)
  editor(on)
  await startSession($, on, { pet: MOCHI, needs: needs(clock.now(), {}) })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await runPet($, 'pet')
  const petted = await petSource(ui)

  await type($, '', 'x')

  expect(await petSource(ui)).toBe(petted)
  await ui.unmount()
})

/** The frames of `behaviour` as the desktop app draws them, facing either way. */
function svgsOf(behaviour: keyof typeof PET_FRAMES, frame = 0): string[] {
  const sprite = PET_FRAMES[behaviour][frame]!
  return [toSvg(sprite, 'red'), toSvg(mirror(sprite), 'red')]
}

/**
 * The turn events as the engine raises them. The test kit carries them, but its types
 * list only the calls a plugin can make, so they are typed here once.
 */
function turnEvents($: Engine) {
  return $.turn as unknown as {
    start: (e: TurnStartInput) => Promise<unknown>
    complete: (e: TurnCompleteInput) => Promise<unknown>
  }
}

/** Stands in for the engine running turns and tools, the tool's run seen by `during`. */
function engineRuns(on: On, during: (tool: string) => Promise<void> = async () => {}) {
  on('turn.start', () => ({ turnId: 't1' }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('tool.call', async (_, e) => {
    await during(e.tool)
    return { result: {} }
  })
}

async function startTurn($: Engine, on: On, during?: (tool: string) => Promise<void>) {
  const clock = mock.clock(on)
  engineRuns(on, during)
  await startSession($, on, { pet: MOCHI, needs: needs(clock.now(), {}) })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await turnEvents($).start({ text: 'go', turnId: 't1' })
  return { clock, ui }
}

for (const [tool, thinking] of [
  ['Read', 'sniffing'],
  ['Grep', 'sniffing'],
  ['Glob', 'sniffing'],
  ['Bash', 'watching'],
  ['Edit', 'carrying'],
  ['Write', 'carrying'],
  ['Agent', 'waiting'],
] as const) {
  test(`while Claude runs ${tool} the pet is ${thinking}`, async ($, on) => {
    let seen: string | undefined
    const { ui } = await startTurn($, on, async () => {
      seen = await petSource(ui)
    })

    await $.tool.call({ tool, command: 'x' } as never)

    expect(svgsOf(thinking)).toContain(seen)
    await ui.unmount()
  })
}

test('waiting on an agent, it dozes off after about two minutes', async ($, on) => {
  let clock: { advance: (ms: number) => Promise<void> } | undefined
  let seen: string | undefined
  const started = await startTurn($, on, async () => {
    await clock!.advance(121_000)
    seen = await petSource(started.ui)
  })
  clock = started.clock

  await $.tool.call({ tool: 'Agent', prompt: 'x' } as never)

  expect(svgsOf('sleep')).toContain(seen)
  await started.ui.unmount()
})

test('a long wait with no tool makes it lie down patiently', async ($, on) => {
  const { clock, ui } = await startTurn($, on)
  expect(svgsOf('watching')).toContain(await petSource(ui))

  await clock.advance(31_000)

  expect(svgsOf('waiting')).toContain(await petSource(ui))
  await ui.unmount()
})

test('when the turn completes it goes back to idle life', async ($, on) => {
  const { clock, ui } = await startTurn($, on)

  await turnEvents($).complete({
    reason: 'answer',
    answer: 'done',
    durationMs: 1000,
    isAborted: false,
    turnId: 't1',
  })
  await clock.advance(1)

  const thinking = (['sniffing', 'watching', 'carrying', 'waiting'] as const).flatMap(
    one => PET_FRAMES[one].flatMap((_, i) => svgsOf(one, i)),
  )
  expect(thinking).not.toContain(await petSource(ui))
  await ui.unmount()
})

test("a subagent's tool calls leave the pet as it was", async ($, on) => {
  let seen: string | undefined
  const { ui } = await startTurn($, on, async () => {
    seen = await petSource(ui)
  })

  await $.tool.call({ tool: 'Read', file_path: '/x', agentId: 'a1' } as never)

  expect(svgsOf('watching')).toContain(seen)
  await ui.unmount()
})

test('the owner typing while Claude works brings the pet over to watch', async ($, on) => {
  editor(on)
  const { clock, ui } = await startTurn($, on)

  await type($, '', 'x')
  await clock.advance(20 * 160)

  expect(curiousSvgs(0)).toContain(await petSource(ui))
  await ui.unmount()
})

/** Every frame of `behaviour` as the desktop app draws them, facing either way. */
function allSvgsOf(behaviour: keyof typeof PET_FRAMES): string[] {
  return PET_FRAMES[behaviour].flatMap((_, i) => svgsOf(behaviour, i))
}

/** A tool's answer as it runs: answered, or failing. */
type Answer = { result: unknown } | { deny: string }

const ANSWERED: Answer = { result: { stdout: 'ok', stderr: '', interrupted: false } }
const FAILED: Answer = { deny: 'exit code 1' }
const REFUSED_ID = 'refused'

/**
 * A main turn running on the desktop app, its tools answering `answers` in order. Every
 * call is allowed but `REFUSED_ID`, which is refused, by the owner if they were asked.
 * The store comes back as a map to read.
 */
async function turnWithAnswers(
  $: Engine,
  on: On,
  answers: Answer[],
  stored: Record<string, unknown> = {},
) {
  const clock = mock.clock(on)
  on('turn.start', () => ({ turnId: 't1' }))
  on('tool.run', () => answers.shift() ?? ANSWERED)
  // The check the owner is put to asks; the call's own is refused when theirs was.
  on('tool.check', (_, e) => {
    if (e.approver === 'person') return { decision: 'ask' }
    return { decision: e.tool_use_id === REFUSED_ID ? 'deny' : 'allow' }
  })
  const store = await startSession($, on, {
    pet: MOCHI,
    needs: needs(clock.now(), { happiness: 50 }),
    ...stored,
  })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await turnEvents($).start({ text: 'go', turnId: 't1' })
  return { clock, store, ui }
}

/** Claude running `command` in Bash. */
function bash($: Engine, command: string, id = 'b1') {
  return $.tool.call({ tool: 'Bash', command, tool_use_id: id } as never)
}

test('a failing tool call makes the pet worried, and a little less happy', async ($, on) => {
  const { clock, store, ui } = await turnWithAnswers($, on, [FAILED])

  await $.tool.call({ tool: 'Read', file_path: '/x' } as never)
  await clock.advance(1)

  expect(allSvgsOf('worried')).toContain(await petSource(ui))
  expect(store.get('needs')).toMatchObject({ happiness: 45 })
  await ui.unmount()
})

test('the worry lasts about five seconds, then it thinks along again', async ($, on) => {
  const { clock, ui } = await turnWithAnswers($, on, [FAILED])

  await bash($, 'ls')
  await clock.advance(5100)

  expect(allSvgsOf('watching')).toContain(await petSource(ui))
  await ui.unmount()
})

test('more trouble in the same turn keeps it worried for longer', async ($, on) => {
  const { clock, ui } = await turnWithAnswers($, on, [FAILED, FAILED])

  await bash($, 'pnpm test', 'b1')
  await bash($, 'pnpm test', 'b2')
  await clock.advance(5100)

  expect(allSvgsOf('worried')).toContain(await petSource(ui))
  await ui.unmount()
})

test('a test passing after trouble is a win: it celebrates and earns a treat', async ($, on) => {
  const { clock, store, ui } = await turnWithAnswers($, on, [FAILED, ANSWERED])

  await bash($, 'pnpm test', 'b1')
  await bash($, 'pnpm test', 'b2')
  await clock.advance(1)

  expect(allSvgsOf('celebrating')).toContain(await petSource(ui))
  expect(store.get('treats')).toBe(1)
  expect(store.get('needs')).toMatchObject({ happiness: 60 })
  expect(await runPet($, 'status')).toMatchObject({
    text: expect.stringContaining('Treats saved: 1.'),
  })
  await ui.unmount()
})

test('a test passing with no trouble before earns nothing', async ($, on) => {
  const { clock, store, ui } = await turnWithAnswers($, on, [ANSWERED])

  await bash($, 'pnpm build')
  await clock.advance(1)

  expect(allSvgsOf('celebrating')).not.toContain(await petSource(ui))
  expect(store.get('treats')).toBeUndefined()
  await ui.unmount()
})

test('the owner refusing a permission makes it tilt its head', async ($, on) => {
  const { clock, store, ui } = await turnWithAnswers($, on, [])
  const check = ($.tool as unknown as { check: (e: unknown) => Promise<unknown> }).check

  // The check the engine raises for Claude's call, before it asks the owner.
  await check({
    tool: 'Bash',
    input: { command: 'rm x' },
    tool_use_id: REFUSED_ID,
    approver: 'person',
  })
  await bash($, 'rm x', REFUSED_ID)
  await clock.advance(1)

  expect(allSvgsOf('confused')).toContain(await petSource(ui))
  expect(store.get('needs')).toMatchObject({ happiness: 50 })
  await ui.unmount()
})

test('a call refused with nobody asked goes by unnoticed', async ($, on) => {
  const { clock, ui } = await turnWithAnswers($, on, [])

  await bash($, 'rm x', REFUSED_ID)
  await clock.advance(1)

  expect(allSvgsOf('watching')).toContain(await petSource(ui))
  await ui.unmount()
})

/** Stands in for the engine beneath the mod: a sent prompt goes in as it is. */
function sends(on: On) {
  on('prompt.submit', (_, e) => ({ text: e.text }))
}

/** The owner pressing Enter on `text`, or on a slash command. */
function send($: Engine, text: string, command?: { name: string; args: string }) {
  return promptEvents($).submit({
    text,
    command,
    wait: false,
    origin: { kind: 'composer' },
  })
}

test('a happy draft makes it wag', async ($, on) => {
  const clock = mock.clock(on)
  editor(on)
  await startSession($, on, { pet: MOCHI, needs: needs(clock.now(), {}) })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })

  await type($, 'thank', 's')
  await clock.advance(1)

  expect(allSvgsOf('wagging')).toContain(await petSource(ui))
  await ui.unmount()
})

test('an angry draft makes it shrink back', async ($, on) => {
  const clock = mock.clock(on)
  editor(on)
  await startSession($, on, { pet: MOCHI, needs: needs(clock.now(), {}) })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })

  await type($, 'wt', 'f')
  await clock.advance(1)

  expect(allSvgsOf('shrinkingBack')).toContain(await petSource(ui))
  await ui.unmount()
})

test('a sad draft brings it close to lie down by the caret', async ($, on) => {
  const clock = mock.clock(on)
  editor(on)
  await startSession($, on, { pet: MOCHI, needs: needs(clock.now(), {}) })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })

  await type($, 'i give u', 'p')
  await clock.advance(20 * 160)

  expect(svgsOf('lieDown')).toContain(await petSource(ui))
  // The caret is at column 2 + 9; the 8-column pup lies centred over it.
  expect((await ui.find({ key: 'pet:spot' }))?.props.marginLeft).toBe(7)
  await ui.unmount()
})

test('a neutral draft only brings it over to watch', async ($, on) => {
  const clock = mock.clock(on)
  editor(on)
  await startSession($, on, { pet: MOCHI, needs: needs(clock.now(), {}) })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })

  await type($, 'add a tes', 't')
  await clock.advance(20 * 160)

  expect(curiousSvgs(0)).toContain(await petSource(ui))
  await ui.unmount()
})

test('a happy prompt sent makes it wag before it thinks along (ADR-0005)', async ($, on) => {
  sends(on)
  const { clock, ui } = await startTurn($, on)

  await send($, 'great, thanks')
  await turnEvents($).start({ text: 'great, thanks', turnId: 't1' })
  await clock.advance(1)

  expect(allSvgsOf('wagging')).toContain(await petSource(ui))
  await clock.advance(6000)
  expect(allSvgsOf('wagging')).not.toContain(await petSource(ui))
  await ui.unmount()
})

test('a slash command sent is not read for tone', async ($, on) => {
  const clock = mock.clock(on)
  sends(on)
  await startSession($, on, { pet: MOCHI, needs: needs(clock.now(), {}) })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const before = await petSource(ui)

  await send($, '/pet name Awesome', { name: 'pet', args: 'name Awesome' })
  await clock.advance(1)

  expect(await petSource(ui)).toBe(before)
  await ui.unmount()
})

test('petting cuts a wag short (ADR-0005)', async ($, on) => {
  const clock = mock.clock(on)
  editor(on)
  await startSession($, on, { pet: MOCHI, needs: needs(clock.now(), {}) })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await type($, 'thank', 's')

  await runPet($, 'pet')

  expect(allSvgsOf('beingPetted')).toContain(await petSource(ui))
  await ui.unmount()
})

test('a happy draft shows a dim *woof woof* beside the pet', async ($, on) => {
  const clock = mock.clock(on)
  editor(on)
  await startSession($, on, { pet: MOCHI, needs: needs(clock.now(), {}) })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })

  await type($, 'thank', 's')
  await clock.advance(1)

  const said = await ui.find({ type: 'Text', text: '*woof woof*' })
  expect(said?.props.dimColor).toBe(true)
  await ui.unmount()
})

test('the emote fades after a few seconds', async ($, on) => {
  const clock = mock.clock(on)
  editor(on)
  await startSession($, on, { pet: MOCHI, needs: needs(clock.now(), {}) })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })

  await type($, 'thank', 's')
  await clock.advance(5000)

  expect(await ui.find({ key: 'pet:emote' })).toBeUndefined()
  await ui.unmount()
})

test(
  'with model tone on, a small model reads the prompt sent (ADR-0002)',
  { options: { modelTone: true } },
  async ($, on) => {
    const clock = mock.clock(on)
    sends(on)
    const asked: string[] = []
    on('model.classify', (_, e) => {
      asked.push(e.text)
      return 'happy'
    })
    await startSession($, on, { pet: MOCHI, needs: needs(clock.now(), {}) })
    const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })

    await send($, 'rename foo to bar')
    await clock.advance(1)

    expect(asked).toEqual(['rename foo to bar'])
    expect(allSvgsOf('wagging')).toContain(await petSource(ui))
    await ui.unmount()
  },
)

test(
  'model tone falls back to the heuristics when the call is not answered',
  { options: { modelTone: true } },
  async ($, on) => {
    const clock = mock.clock(on)
    sends(on)
    on('model.classify', () => {
      throw new Error('api-error')
    })
    await startSession($, on, { pet: MOCHI, needs: needs(clock.now(), {}) })
    const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })

    await send($, 'great, thanks')
    await clock.advance(1)

    expect(allSvgsOf('wagging')).toContain(await petSource(ui))
    await ui.unmount()
  },
)

test('model tone is off by default: no model is asked', async ($, on) => {
  const clock = mock.clock(on)
  sends(on)
  let isAsked = false
  on('model.classify', () => {
    isAsked = true
    return 'happy'
  })
  await startSession($, on, { pet: MOCHI, needs: needs(clock.now(), {}) })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })

  await send($, 'great, thanks')
  await clock.advance(1)

  expect(isAsked).toBe(false)
  expect(allSvgsOf('wagging')).toContain(await petSource(ui))
  await ui.unmount()
})
