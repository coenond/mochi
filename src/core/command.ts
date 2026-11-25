// The `/pet` command: the owner's words in, what to keep and what to reply out.

import { adopt, NO_PET_YET, rename, type AdoptionOutcome, type Pet } from './adoption'
import { feed, freshNeeds, passTime, petting, type Needs } from './needs'

/** What the store holds of the one pet: `null` for what is not there yet. */
export type Home = { pet: Pet | null; needs: Needs | null }

export type PetCommandOutcome =
  | AdoptionOutcome
  | { kind: 'fed'; needs: Needs; reply: string }
  | { kind: 'petted'; needs: Needs; reply: string }

const USAGE = 'Usage: /pet adopt <name> [coat] · name <name> · feed · pet · status'

export function petCommand(args: string, home: Home, now: number): PetCommandOutcome {
  const [verb, ...rest] = words(args)
  const { pet } = home

  if (verb === 'adopt') return adopt(rest, pet, now)
  if (verb === 'name') return rename(rest, pet)
  if (verb !== 'feed' && verb !== 'pet' && verb !== 'status') return reply(USAGE)
  if (pet === null) return reply(NO_PET_YET)

  // A pet adopted before it had needs is taken to be full and rested.
  const needs = passTime(home.needs ?? freshNeeds(now), now, false)

  if (verb === 'status') return reply(status(pet, needs))
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

function status({ name, coat }: Pet, { hunger, happiness, energy }: Needs): string {
  const [h, p, e] = [hunger, happiness, energy].map(Math.round)
  // Treats come with ticket #10; until then there are none to save.
  return `${name}, ${coat} coat. Hunger ${h}, happiness ${p}, energy ${e}. Treats saved: 0.`
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
