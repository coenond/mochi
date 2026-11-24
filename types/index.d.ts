// The state contract. The engine wants it self-contained, so `Coat` and `Pet` mirror the
// core's (src/core/sprites.ts, src/core/adoption.ts); the shell's type-check catches drift.

export type Coat = 'golden' | 'light' | 'red'

export type Pet = { name: string; coat: Coat }

/**
 * Whether this session's terminal draws the pet as an image: `null` until the probe has
 * asked the engine, then `false` where the band shows the half-block fallback.
 */
export type TerminalDrawsImages = boolean | null

/**
 * An adoption waiting on the owner to pick a coat in the band: the name they gave and
 * the coat the pup shows while they choose. `null` when no adoption waits.
 */
export type CoatPick = { name: string; coat: Coat } | null

declare module 'claude-code' {
  interface PluginState {
    mochi: {
      terminalDrawsImages: TerminalDrawsImages
      /** This session's copy of the one pet in the store; `null` before adoption. */
      pet: Shaped<Pet | null>
      coatPick: Shaped<CoatPick>
    }
  }
}
