// The pet's needs: hunger, happiness and energy, each 0 to 100, drifting on wall-clock
// time, also while Claude Code is closed. They bottom out and nothing worse happens: the
// pet never dies, falls ill or leaves (ADR-0003).

export type Needs = {
  /** 100 is full. */
  hunger: number
  happiness: number
  /** 100 is wide awake. */
  energy: number
  /** When the levels were true, in milliseconds since the epoch. */
  at: number
}

/** A gap this long with no session counts as Claude Code closed, the pet asleep. */
export const CLOSED_AFTER_MS = 5 * 60_000

const HOUR = 3_600_000
const HUNGER_EMPTIES_MS = 8 * HOUR
const ENERGY_DRAINS_MS = 16 * HOUR
const ENERGY_REFILLS_MS = 2 * HOUR
const HAPPINESS_FADES_MS = 24 * HOUR

const KIBBLE = 30
const PETTING = 10
const FULL_AT = 90
const HUNGRY_UNDER = 25
const TIRED_UNDER = 25

export function freshNeeds(now: number): Needs {
  return { hunger: 100, happiness: 100, energy: 100, at: now }
}

/** The needs brought up to `now`; `isAsleep` says whether the pet slept meanwhile. */
export function passTime(needs: Needs, now: number, isAsleep: boolean): Needs {
  const elapsed = now - needs.at
  if (elapsed <= 0) return needs

  const asleep = isAsleep || elapsed >= CLOSED_AFTER_MS
  const energy = asleep
    ? (elapsed / ENERGY_REFILLS_MS) * 100
    : -(elapsed / ENERGY_DRAINS_MS) * 100

  return {
    hunger: level(needs.hunger - (elapsed / HUNGER_EMPTIES_MS) * 100),
    happiness: level(needs.happiness - (elapsed / HAPPINESS_FADES_MS) * 100),
    energy: level(needs.energy + energy),
    at: now,
  }
}

/** A bowl of kibble, refused by a full pet. */
export function feed(needs: Needs): { needs: Needs; isRefused: boolean } {
  if (needs.hunger >= FULL_AT) return { needs, isRefused: true }
  return { needs: { ...needs, hunger: level(needs.hunger + KIBBLE) }, isRefused: false }
}

/** The owner petting the pet: a little happier each time. */
export function petting(needs: Needs): Needs {
  return { ...needs, happiness: level(needs.happiness + PETTING) }
}

export function isHungry(needs: Needs): boolean {
  return needs.hunger < HUNGRY_UNDER
}

export function isTired(needs: Needs): boolean {
  return needs.energy < TIRED_UNDER
}

/** The needs kept in the store, or `null` when there are none or they cannot be read. */
export function storedNeeds(value: unknown): Needs | null {
  if (typeof value !== 'object' || value === null) return null
  const { hunger, happiness, energy, at } = value as Record<string, unknown>
  const numbers = [hunger, happiness, energy, at]
  if (!numbers.every(n => typeof n === 'number' && Number.isFinite(n))) return null
  return {
    hunger: level(hunger as number),
    happiness: level(happiness as number),
    energy: level(energy as number),
    at: at as number,
  }
}

function level(value: number): number {
  return Math.min(100, Math.max(0, value))
}
