# mochi

A cozy pixel-art golden retriever puppy for [Claude Code](https://claude.com/claude-code). Mochi lives just above your prompt, wanders around, does the odd trick, naps, and reacts to what is happening in your session: curious while you type, thinking while Claude works, worried when things break and over the moon when they work out again.

Feed it, pet it, give it treats you earned. It never makes a sound and never interrupts you.

> Work in progress. See `docs/specs/0001-mochi-v1.md` and the open issues.

## Settings

- **Model tone** (`modelTone`, off by default): Mochi reads the tone of what you write with local heuristics. Turn this on to have a small model read each prompt you send instead. Every call is billed to your Claude Code session and adds a short delay before Mochi reacts. When a call is not answered, Mochi falls back to the heuristics. Your draft is always read locally.

## Developing

Mochi is a Claude Code mod. Install the tools with `pnpm install`; that also sets up the pre-commit hook.

- `pnpm check`: typecheck, unit tests (Vitest, `src/**/*.spec.ts`) and formatting, as CI runs them.
- `pnpm test:plugin`: the engine tests (`claude plugin test`, `hooks/**/*.test.tsx`).
- `pnpm validate`: `claude plugin validate`.
- `claude --plugin-dir .`: a session with Mochi loaded, to see the band.

## License

MIT
