import { expect, mock, test } from 'claude-code/testing'

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

test('the desktop app, VS Code and mobile draw the pet as an SVG', async $ => {
  for (const surface of ['desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })

    const pet = await ui.find({ type: 'Svg' })
    expect(pet?.props.alt).toBe('Mochi')
    expect(pet?.props.source).toMatch(/^<svg [^>]*viewBox="0 0 32 24"/)
    await ui.unmount()
  }
})

test('the terminal draws the pet as a 3-row image at first', async $ => {
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })

  const pet = await ui.find({ type: 'Image', key: 'pet' })
  expect(pet?.props.rows).toBe(3)
  expect(pet?.props.source).toMatchObject({ width: 32, height: 24 })
  await ui.unmount()
})

test('a terminal that shows the alt in place of the image gets the half-block fallback', async ($, on) => {
  const clock = mock.clock(on)
  on('ui.blit', () => ({ value: { deny: 'the Image draws its alt there' } }))

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

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await clock.advance(300)

  expect(await ui.find({ type: 'Image', key: 'pet' })).toBeDefined()
  await ui.unmount()
})

test('a probe refused for another reason tries again', async ($, on) => {
  const clock = mock.clock(on)
  const answers = [{ deny: 'nothing of this plugin is mounted there' }, {}]
  on('ui.blit', () => ({ value: answers.shift() ?? {} }))

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await clock.advance(300)
  await clock.advance(300)

  expect(answers).toHaveLength(0)
  expect(await ui.find({ type: 'Image', key: 'pet' })).toBeDefined()
  await ui.unmount()
})

test('the pet yields the band to a survey', async $ => {
  const ui = await $.ui.mount({
    ...BAND,
    surface: 'terminal',
    props: { ...BAND.props, hasSurvey: true },
  })

  expect(await ui.find({ key: 'pet' })).toBeUndefined()
  await ui.unmount()
})
