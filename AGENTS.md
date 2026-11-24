# AGENTS.md

Mochi is a Claude Code mod: a cozy 8-bit pet dog that lives in the band above the prompt. This is an AI-engineering project, not a vibe-coding project. Agents work in small, verified, vertical steps that a human has agreed to.

## Workflow

1. **Grill** the idea until there is a shared understanding. Decisions belong to the human; facts are the agent's job to look up.
2. **Record** decisions that are hard to reverse, surprising without context, and the result of a real trade-off as an ADR in `docs/adr/`. Everything else stays out of the repo.
3. **Spec** the feature (`docs/specs/`), then split it into **tracer-bullet tickets** (GitHub Issues, label `ready-for-agent`), each a thin vertical slice the owner can see in the band.
4. **Implement** one ticket at a time with red-green-refactor TDD.
5. **Review** the diff against the ticket and the repo standards before committing.

Never start implementing a feature that has no agreed ticket.

## Rules

- Read `GLOSSARY.md` before naming anything. Use its terms in code, tests, commits and issues. Add a term there when a new concept is agreed.
- Read the relevant ADRs before changing architecture. Do not re-litigate an accepted ADR; propose a new one that supersedes it.
- ADR format: `docs/adr/NNNN-slug.md`, sequential numbers, a few sentences of context, decision and why. Status: `proposed | accepted | deprecated | superseded by ADR-NNNN`.
- `docs/prototypes/` is reference material. Never import from it.
- No em dashes in prose.

## Scope guardrails

- The pet must never distract from work: no sounds, no toasts, no notifications, no status line entries. The only text is the emote (ADR-0004).
- The pet never dies, falls ill or runs away (ADR-0003).
- One pet per owner, across all projects and sessions (ADR-0003).
- Every interaction works without a mouse. Clicking is a shortcut, never the only way.
- No model calls unless the owner turns on model tone (ADR-0002).

## Feedback loops

See ADR-0006. TDD is required for the core (behaviour choice, needs, tone, sprites). The engine shell is covered by `claude plugin test` on terminal and desktop. Looks are checked by eye in the band.
