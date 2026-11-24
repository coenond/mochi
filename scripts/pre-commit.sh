#!/bin/sh
# Pre-commit checks (ADR-0006). The engine checks need Claude Code on the PATH; the
# plugin type-check needs the types the engine lays in .claude-plugin/types/ once it
# has loaded the mod.
set -e

pnpm -s typecheck
pnpm -s test
pnpm -s format:check

if command -v claude >/dev/null 2>&1; then
  claude plugin validate .
else
  echo "pre-commit: claude is not on the PATH, so claude plugin validate was skipped" >&2
fi

if [ -f .claude-plugin/types/tsconfig.json ]; then
  pnpm -s typecheck:plugin
else
  echo "pre-commit: no engine types yet, so the plugin type-check was skipped" >&2
fi
