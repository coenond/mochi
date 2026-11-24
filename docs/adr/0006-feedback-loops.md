---
status: proposed
---

# Feedback loops: pre-commit checks plus a small CI

Every commit must pass typecheck (`tsc`), unit tests (Vitest), `claude plugin validate`, and Prettier formatting, enforced locally by a pre-commit hook. Because the repo is public and others may send pull requests, a GitHub Actions workflow runs the same typecheck, tests and formatting on pushes and pull requests. `claude plugin test` integration tests run locally only, since they need Claude Code installed. Package manager: pnpm.
