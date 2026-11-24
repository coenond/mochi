import { describe, expect, it } from 'vitest'

import { petCommand, storedPet, type Pet } from './adoption'

const MOCHI: Pet = { name: 'Mochi', coat: 'golden' }

describe('/pet adopt', () => {
  it('adopts a pet with the coat the owner names', () => {
    expect(petCommand('adopt Mochi light', null)).toEqual({
      kind: 'adopted',
      pet: { name: 'Mochi', coat: 'light' },
      reply: 'Mochi is home.',
    })
  })

  it('reads the coat in any case', () => {
    expect(petCommand('adopt Mochi RED', null)).toMatchObject({
      pet: { name: 'Mochi', coat: 'red' },
    })
  })

  it('leaves the coat to the owner when none is named', () => {
    expect(petCommand('adopt Mochi', null)).toEqual({
      kind: 'pickCoat',
      name: 'Mochi',
      reply: "Pick Mochi's coat in the band (ctrl+x tab to reach it).",
    })
  })

  it('keeps a name of several words', () => {
    expect(petCommand('adopt  Sir   Biscuit  red', null)).toMatchObject({
      pet: { name: 'Sir Biscuit', coat: 'red' },
    })
  })

  it('takes a lone coat word as the name', () => {
    expect(petCommand('adopt Red', null)).toMatchObject({ kind: 'pickCoat', name: 'Red' })
  })

  it('asks for a name when none is given', () => {
    expect(petCommand('adopt', null)).toEqual({
      kind: 'reply',
      reply: 'Usage: /pet adopt <name> [golden|light|red]',
    })
  })

  it('refuses a name longer than 16 characters', () => {
    expect(petCommand('adopt Bartholomew the Third', null)).toEqual({
      kind: 'reply',
      reply: 'A name can be at most 16 characters.',
    })
  })

  it('drops control characters from the name', () => {
    expect(petCommand('adopt Mo\u001b[31mchi golden', null)).toMatchObject({
      pet: { name: 'Mo[31mchi' },
    })
  })

  it('keeps the one pet an owner already has', () => {
    expect(petCommand('adopt Biscuit red', MOCHI)).toEqual({
      kind: 'reply',
      reply: 'Mochi is already home. Rename with /pet name <name>.',
    })
  })
})

describe('/pet name', () => {
  it('renames the pet and keeps its coat', () => {
    expect(petCommand('name Biscuit', MOCHI)).toEqual({
      kind: 'renamed',
      pet: { name: 'Biscuit', coat: 'golden' },
      reply: 'Mochi is now called Biscuit.',
    })
  })

  it('takes the whole rest as the name, coat words included', () => {
    expect(petCommand('name Little Red', MOCHI)).toMatchObject({
      pet: { name: 'Little Red', coat: 'golden' },
    })
  })

  it('needs a pet first', () => {
    expect(petCommand('name Biscuit', null)).toEqual({
      kind: 'reply',
      reply: 'No pup yet. /pet adopt <name> to adopt one.',
    })
  })

  it('asks for a name when none is given', () => {
    expect(petCommand('name', MOCHI)).toEqual({
      kind: 'reply',
      reply: 'Usage: /pet name <name>',
    })
  })

  it('refuses a name longer than 16 characters', () => {
    expect(petCommand('name Bartholomew the Third', MOCHI)).toMatchObject({
      kind: 'reply',
    })
  })
})

describe('/pet', () => {
  it.each(['', 'dance', 'ADOPT Mochi'])('lists what it can do for "%s"', args => {
    expect(petCommand(args, null)).toEqual({
      kind: 'reply',
      reply: 'Usage: /pet adopt <name> [coat] · /pet name <name>',
    })
  })
})

describe('storedPet', () => {
  it('reads back a pet that was stored', () => {
    expect(storedPet({ name: 'Mochi', coat: 'red' })).toEqual({
      name: 'Mochi',
      coat: 'red',
    })
  })

  it.each([
    ['nothing', undefined],
    ['no name', { coat: 'red' }],
    ['an empty name', { name: '', coat: 'red' }],
    ['an unknown coat', { name: 'Mochi', coat: 'blue' }],
    ['not a pet at all', 'Mochi'],
  ])('finds no pet in %s', (_, value) => {
    expect(storedPet(value)).toBeNull()
  })
})
