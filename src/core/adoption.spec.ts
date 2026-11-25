import { describe, expect, it } from 'vitest'

import { storedPet } from './adoption'

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
