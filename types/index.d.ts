/**
 * Whether this session's terminal draws the pet as an image: `null` until the probe has
 * asked the engine, then `false` where the band shows the half-block fallback.
 */
export type TerminalDrawsImages = boolean | null

declare module 'claude-code' {
  interface PluginState {
    mochi: { terminalDrawsImages: TerminalDrawsImages }
  }
}
