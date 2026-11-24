---
status: accepted
---

# Pure core, thin engine shell

All pet logic lives in plain TypeScript modules with no dependency on the Claude Code mod engine: choosing a behaviour from what is happening (with a fixed priority), needs and their drift, tone, and turning sprites into half-block rows. The mod's `register.tsx` only translates engine events and the clock into core inputs and draws the core's output in the band. This keeps the logic fast to test with plain unit tests, and keeps the engine's large and changing API at one seam.

Behaviour priority, highest first: being petted or fed, reactions to trouble and wins, the owner's tone, Claude working, needs, idle behaviour and tricks.
