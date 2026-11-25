// Adoption and naming: what `/pet adopt` and `/pet name` do with the owner's words, and
// reading the one pet back from the cross-session store (ADR-0003).

import { freshNeeds, type Needs } from './needs'
import { COATS, type Coat } from './sprites'

export type Pet = { name: string; coat: Coat }

/** What adopting or naming comes to; the shell keeps any pet or needs it names. */
export type AdoptionOutcome =
  | { kind: 'reply'; reply: string }
  | { kind: 'adopted'; pet: Pet; needs: Needs; reply: string }
  | { kind: 'renamed'; pet: Pet; reply: string }
  /** Adoption waits on the owner picking a coat in the band. */
  | { kind: 'pickCoat'; name: string; reply: string }

export const MAX_NAME_LENGTH = 16

export const NO_PET_YET = 'No pup yet. /pet adopt <name> to adopt one.'

const ADOPT_USAGE = `Usage: /pet adopt <name> [${COATS.join('|')}]`
const NAME_USAGE = 'Usage: /pet name <name>'
const TOO_LONG = `A name can be at most ${MAX_NAME_LENGTH} characters.`

/** The pet kept in the store, or `null` when there is none or it cannot be read. */
export function storedPet(value: unknown): Pet | null {
  if (typeof value !== 'object' || value === null) return null
  const { name, coat } = value as Record<string, unknown>
  if (typeof name !== 'string' || name === '') return null
  if (!isCoat(coat)) return null
  return { name, coat }
}

/** `/pet adopt`: `rest` is the owner's words after the verb. */
export function adopt(rest: string[], pet: Pet | null, now: number): AdoptionOutcome {
  if (pet !== null) {
    return reply(`${pet.name} is already home. Rename with /pet name <name>.`)
  }

  const last = rest.at(-1)?.toLowerCase()
  const coat = rest.length > 1 && isCoat(last) ? last : undefined
  const name = (coat === undefined ? rest : rest.slice(0, -1)).join(' ')

  if (name === '') return reply(ADOPT_USAGE)
  if (name.length > MAX_NAME_LENGTH) return reply(TOO_LONG)
  if (coat === undefined) {
    return {
      kind: 'pickCoat',
      name,
      reply: `Pick ${name}'s coat in the band (ctrl+x tab to reach it).`,
    }
  }
  return {
    kind: 'adopted',
    pet: { name, coat },
    needs: freshNeeds(now),
    reply: `${name} is home.`,
  }
}

/** `/pet name`: `rest` is the owner's words after the verb. */
export function rename(rest: string[], pet: Pet | null): AdoptionOutcome {
  if (pet === null) return reply(NO_PET_YET)

  const name = rest.join(' ')
  if (name === '') return reply(NAME_USAGE)
  if (name.length > MAX_NAME_LENGTH) return reply(TOO_LONG)
  return {
    kind: 'renamed',
    pet: { ...pet, name },
    reply: `${pet.name} is now called ${name}.`,
  }
}

function isCoat(value: unknown): value is Coat {
  return COATS.includes(value as Coat)
}

function reply(text: string): AdoptionOutcome {
  return { kind: 'reply', reply: text }
}
