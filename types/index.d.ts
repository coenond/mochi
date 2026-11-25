// The state contract. The engine wants it self-contained, so `Coat`, `Pet` and
// `IdleBehaviour` mirror the core's (src/core/sprites.ts, adoption.ts, idle.ts); the
// shell's type-check catches drift.

export type Coat = 'golden' | 'light' | 'red'

export type Pet = { name: string; coat: Coat }

export type IdleBehaviour = 'walk' | 'sit' | 'lieDown' | 'sleep' | 'yawn' | 'scratch'

/** What the band draws of the pet's idle life: a frame of a behaviour, where and facing. */
export type IdlePose = {
  behaviour: IdleBehaviour
  frame: number
  /** Columns from the band's left edge. */
  x: number
  facing: 'left' | 'right'
}

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
      idlePose: Shaped<IdlePose>
    }
  }
}
