// The `/pet` command: the owner's words in, what to keep and what to reply out.

import { adopt, NO_PET_YET, rename, type AdoptionOutcome, type Pet } from './adoption'
import { feed, freshNeeds, passTime, petting, treat, type Needs } from './needs'

/** What the store holds of the one pet: `null` for what is not there yet. */
export type Home = {
  pet: Pet | null
  needs: Needs | null
  /** Treats earned with wins and not given yet; none when left out. */
  treats?: number
}

export type PetCommandOutcome =
  | AdoptionOutcome
  | { kind: 'fed'; needs: Needs; reply: string }
  | { kind: 'petted'; needs: Needs; reply: string }
  /** A saved treat given: the needs after it, and the treats left. */
  | { kind: 'treated'; needs: Needs; treats: number; reply: string }

const USAGE =
  'Usage: /pet adopt <name> [coat] · name <name> · feed · pet · treat · status'

export function petCommand(args: string, home: Home, now: number): PetCommandOutcome {
  const [verb, ...rest] = words(args)
  const { pet } = home

  if (verb === 'adopt') return adopt(rest, pet, now)
  if (verb === 'name') return rename(rest, pet)
  if (!['feed', 'pet', 'treat', 'status'].includes(verb ?? '')) return reply(USAGE)
  if (pet === null) return reply(NO_PET_YET)

  // A pet adopted before it had needs is taken to be full and rested.
  const needs = passTime(home.needs ?? freshNeeds(now), now, false)

  const treats = home.treats ?? 0

  if (verb === 'status') return reply(status(pet, needs, treats))
  if (verb === 'treat') {
    if (treats === 0) return reply(`No treats saved. ${pet.name} earns them with wins.`)
    return {
      kind: 'treated',
      needs: treat(needs),
      treats: treats - 1,
      reply: `${pet.name} gobbles the treat and does a trick.`,
    }
  }
  if (verb === 'pet') {
    return {
      kind: 'petted',
      needs: petting(needs),
      reply: `${pet.name} leans into your hand.`,
    }
  }

  const fed = feed(needs)
  if (fed.isRefused) return reply(`${pet.name} is full.`)
  return {
    kind: 'fed',
    needs: fed.needs,
    reply: `${pet.name} crunches through the kibble.`,
  }
}

function status(
  { name, coat }: Pet,
  { hunger, happiness, energy }: Needs,
  treats: number,
): string {
  const [h, p, e] = [hunger, happiness, energy].map(Math.round)
  return `${name}, ${coat} coat. Hunger ${h}, happiness ${p}, energy ${e}. Treats saved: ${treats}.`
}

/** The owner's words, control characters dropped, split on any run of spaces. */
function words(args: string): string[] {
  return args
    .replace(/\p{Cc}/gu, '')
    .split(/\s+/)
    .filter(word => word !== '')
}

function reply(text: string): PetCommandOutcome {
  return { kind: 'reply', reply: text }
}
