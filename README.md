# mochi

A cozy pixel-art golden retriever puppy for [Claude Code](https://claude.com/claude-code). Mochi lives just above your prompt, wanders around, does the odd trick, naps, and reacts to what is happening in your session: curious while you type, thinking while Claude works, worried when things break and over the moon when they work out again.

Feed it, pet it, give it treats you earned. It never makes a sound and never interrupts you.

> Work in progress. See `docs/specs/0001-mochi-v1.md` and the open issues.

## Developing

Mochi is a Claude Code mod. Install the tools with `pnpm install`; that also sets up the pre-commit hook.

- `pnpm check`: typecheck, unit tests (Vitest, `src/**/*.spec.ts`) and formatting, as CI runs them.
- `pnpm test:plugin`: the engine tests (`claude plugin test`, `hooks/**/*.test.tsx`).
- `pnpm validate`: `claude plugin validate`.
- `claude --plugin-dir .`: a session with Mochi loaded, to see the band.

## License

MIT
