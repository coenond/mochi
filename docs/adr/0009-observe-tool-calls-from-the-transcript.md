---
status: accepted
---

# Observe Claude's tool calls from the transcript, not the tool chain

Thinking along (ADR-0005) hooks `tool.call` with no matcher, so it may match every tool. The engine's types (Claude Code 2.1.331, at `tool.run`, "as at `tool.call`") say a hook that may match a tool, even one that only passes `next(e)` on, turns off for that tool the move to the background (Bash `run_in_background`, ctrl+b), a served call's live output and Code Mode's wait for a stopped result. The pet would then get in the way of work, which the scope guardrails forbid. This rests on the docs; a live check in the desktop app is still to be done. Mochi only needs to know which tool Claude is on and when it is done, and soon whether a call failed (trouble) or a test passed after it (win).

Decision: drop the `tool.call` hook. Hook `session.append` on the doors `response` and `tool-result`, main loop only (`agentId` absent), observe only. A response row holding a `tool_use` block starts thinking of that tool; a tool result row (`origin.tool` names it, `is_error` says trouble) sends the pet back to watching. No hook sits in any tool's chain, so no tool loses anything.

Considered:

- **Narrow the `tool.call` matcher** to the tools Mochi tells apart. Only Read, Grep, Glob, LSP, WebFetch, WebSearch, Edit, Write and NotebookEdit never background or stream; Agent can be moved to the background, so waiting on an agent would need another source anyway. Bash would no longer restart the patient-wait clock, so a long run of commands lets the pet lie down sooner. Keeps exact timing, but every new tool Mochi reacts to is a fresh cost to weigh, and trouble needs every tool.
- **`turn.step`**: the response's `toolUses` would do, but every chunk of every model response then streams through Mochi's generator, the hottest path in the session.
- **Classic `PreToolUse` and `PostToolUse(Failure)` in the hooks module**: the docs do not say whether these carry the same cost, and they would still put Mochi in each tool's chain.

Cost of the decision: the timing comes from rows, not the call itself. With parallel calls the pet thinks of the last one named and goes back to watching at the first result, while others may still run. A backgrounded command's result row comes at once, so the pet watches while it runs. All of this is hard to see at the band's pace.
