import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On, UiFocusInput } from 'claude-code'

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
  expect(await ui.find({ type: 'Button' })).toBeUndefined()
  expect(await ui.find({ key: 'pet' })).toBeDefined()
  await ui.unmount()
})

test('the coat with focus shows on the pup before it is picked', async ($, on) => {
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
  const store = await startSession($, on, { pet: MOCHI })

  const { text } = await runPet($, 'name Biscuit')

  expect(text).toBe('Mochi is now called Biscuit.')
  expect(store.get('pet')).toEqual({ name: 'Biscuit', coat: 'red' })
})

test('/pet adopt sees a pet another session adopted since this one started', async ($, on) => {
  const store = await startSession($, on)
  store.set('pet', MOCHI)

  const { text } = await runPet($, 'adopt Biscuit golden')

  expect(text).toBe('Mochi is already home. Rename with /pet name <name>.')
  expect(store.get('pet')).toEqual(MOCHI)
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await ui.find({ type: 'Svg' }))?.props.alt).toBe('Mochi')
  await ui.unmount()
})
