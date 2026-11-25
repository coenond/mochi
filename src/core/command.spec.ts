import { describe, expect, it } from 'vitest'

import type { Pet } from './adoption'
import { petCommand, type Home } from './command'
import type { Needs } from './needs'

const NOW = 1_000_000
const NO_PET: Home = { pet: null, needs: null }

const MOCHI: Pet = { name: 'Mochi', coat: 'golden' }
const NEEDS: Needs = { hunger: 40, happiness: 80, energy: 60, at: NOW }
const HOME: Home = { pet: MOCHI, needs: NEEDS }

describe('/pet adopt', () => {
  it('adopts a pet with the coat the owner names', () => {
    expect(petCommand('adopt Mochi light', NO_PET, NOW)).toEqual({
      kind: 'adopted',
      pet: { name: 'Mochi', coat: 'light' },
      needs: { hunger: 100, happiness: 100, energy: 100, at: NOW },
      reply: 'Mochi is home.',
    })
  })

  it('reads the coat in any case', () => {
    expect(petCommand('adopt Mochi RED', NO_PET, NOW)).toMatchObject({
      pet: { name: 'Mochi', coat: 'red' },
    })
  })

  it('leaves the coat to the owner when none is named', () => {
    expect(petCommand('adopt Mochi', NO_PET, NOW)).toEqual({
      kind: 'pickCoat',
      name: 'Mochi',
      reply: "Pick Mochi's coat in the band (ctrl+x tab to reach it).",
    })
  })

  it('keeps a name of several words', () => {
    expect(petCommand('adopt  Sir   Biscuit  red', NO_PET, NOW)).toMatchObject({
      pet: { name: 'Sir Biscuit', coat: 'red' },
    })
  })

  it('takes a lone coat word as the name', () => {
    expect(petCommand('adopt Red', NO_PET, NOW)).toMatchObject({
      kind: 'pickCoat',
      name: 'Red',
    })
  })

  it('asks for a name when none is given', () => {
    expect(petCommand('adopt', NO_PET, NOW)).toEqual({
      kind: 'reply',
      reply: 'Usage: /pet adopt <name> [golden|light|red]',
    })
  })

  it('refuses a name longer than 16 characters', () => {
    expect(petCommand('adopt Bartholomew the Third', NO_PET, NOW)).toEqual({
      kind: 'reply',
      reply: 'A name can be at most 16 characters.',
    })
  })

  it('drops control characters from the name', () => {
    expect(petCommand('adopt Mo\u001b[31mchi golden', NO_PET, NOW)).toMatchObject({
      pet: { name: 'Mo[31mchi' },
    })
  })

  it('keeps the one pet an owner already has', () => {
    expect(petCommand('adopt Biscuit red', HOME, NOW)).toEqual({
      kind: 'reply',
      reply: 'Mochi is already home. Rename with /pet name <name>.',
    })
  })
})

describe('/pet name', () => {
  it('renames the pet and keeps its coat', () => {
    expect(petCommand('name Biscuit', HOME, NOW)).toEqual({
      kind: 'renamed',
      pet: { name: 'Biscuit', coat: 'golden' },
      reply: 'Mochi is now called Biscuit.',
    })
  })

  it('takes the whole rest as the name, coat words included', () => {
    expect(petCommand('name Little Red', HOME, NOW)).toMatchObject({
      pet: { name: 'Little Red', coat: 'golden' },
    })
  })

  it('needs a pet first', () => {
    expect(petCommand('name Biscuit', NO_PET, NOW)).toEqual({
      kind: 'reply',
      reply: 'No pup yet. /pet adopt <name> to adopt one.',
    })
  })

  it('asks for a name when none is given', () => {
    expect(petCommand('name', HOME, NOW)).toEqual({
      kind: 'reply',
      reply: 'Usage: /pet name <name>',
    })
  })

  it('refuses a name longer than 16 characters', () => {
    expect(petCommand('name Bartholomew the Third', HOME, NOW)).toMatchObject({
      kind: 'reply',
    })
  })
})

describe('/pet', () => {
  it.each(['', 'dance', 'ADOPT Mochi'])('lists what it can do for "%s"', args => {
    expect(petCommand(args, NO_PET, NOW)).toEqual({
      kind: 'reply',
      reply: 'Usage: /pet adopt <name> [coat] · name <name> · feed · status',
    })
  })
})

describe('/pet feed', () => {
  it('gives a bowl of kibble', () => {
    expect(petCommand('feed', HOME, NOW)).toEqual({
      kind: 'fed',
      needs: { ...NEEDS, hunger: 70 },
      reply: 'Mochi crunches through the kibble.',
    })
  })

  it('brings the needs up to now before feeding', () => {
    const outcome = petCommand('feed', HOME, NOW + 60 * 60_000)

    expect(outcome).toMatchObject({ kind: 'fed', needs: { at: NOW + 60 * 60_000 } })
    expect(outcome.kind === 'fed' && outcome.needs.hunger).toBeCloseTo(40 - 12.5 + 30)
  })

  it('is refused by a full pet', () => {
    expect(
      petCommand('feed', { pet: MOCHI, needs: { ...NEEDS, hunger: 95 } }, NOW),
    ).toEqual({
      kind: 'reply',
      reply: 'Mochi is full.',
    })
  })

  it('feeds a pet whose needs were never kept as a full one, so it refuses', () => {
    expect(petCommand('feed', { pet: MOCHI, needs: null }, NOW)).toMatchObject({
      reply: 'Mochi is full.',
    })
  })

  it('needs a pet first', () => {
    expect(petCommand('feed', NO_PET, NOW)).toEqual({
      kind: 'reply',
      reply: 'No pup yet. /pet adopt <name> to adopt one.',
    })
  })
})

describe('/pet status', () => {
  it('shows name, coat, needs as whole numbers and treats saved', () => {
    const needs = { ...NEEDS, hunger: 39.6, happiness: 80.2 }

    expect(petCommand('status', { pet: MOCHI, needs }, NOW)).toEqual({
      kind: 'reply',
      reply: 'Mochi, golden coat. Hunger 40, happiness 80, energy 60. Treats saved: 0.',
    })
  })

  it('brings the needs up to now first', () => {
    expect(petCommand('status', HOME, NOW + 8 * 60 * 60_000)).toMatchObject({
      reply: expect.stringContaining('Hunger 0,'),
    })
  })

  it('needs a pet first', () => {
    expect(petCommand('status', NO_PET, NOW)).toMatchObject({
      reply: 'No pup yet. /pet adopt <name> to adopt one.',
    })
  })
})
