// Trouble, wins and confusion: what a tool call of Claude's that ended comes to for the
// pet. A failing call is trouble. A test or build command that passes while trouble is
// pending is a win, which earns a treat. The owner refusing a permission is confusion.

import type { WorkReaction } from './idle'

/**
 * Trouble pending since the last win, and how much of it came in this turn. A win
 * clears it; a new turn starts the count over.
 */
export type Trouble = { isPending: boolean; thisTurn: number }

export const NO_TROUBLE: Trouble = { isPending: false, thisTurn: 0 }

/**
 * How a tool call ended: answered, errored, refused by the owner when asked, refused with
 * nobody asked (a rule, a hook, a classifier), or interrupted by the owner stopping Claude.
 */
export type ToolCallEnd = {
  tool: string
  /** Bash only: the command it ran. */
  command?: string
  outcome: 'answered' | 'error' | 'refusedByOwner' | 'refused' | 'interrupted'
}

/** What the pet makes of a tool call that ended. */
export type Notice = {
  trouble: Trouble
  reaction: WorkReaction | null
  isWin: boolean
}

export function noticeToolCall(trouble: Trouble, call: ToolCallEnd): Notice {
  if (call.outcome === 'error') {
    return {
      trouble: { isPending: true, thisTurn: trouble.thisTurn + 1 },
      reaction: 'worried',
      isWin: false,
    }
  }
  if (call.outcome === 'refusedByOwner') {
    return { trouble, reaction: 'confused', isWin: false }
  }
  const isWin =
    call.outcome === 'answered' &&
    trouble.isPending &&
    call.tool === 'Bash' &&
    call.command !== undefined &&
    isTestOrBuild(call.command)
  if (isWin) return { trouble: NO_TROUBLE, reaction: 'celebrating', isWin: true }
  return { trouble, reaction: null, isWin: false }
}

/** A new turn of Claude's: trouble still pending, none of it in this turn yet. */
export function turnStarted(trouble: Trouble): Trouble {
  return { ...trouble, thisTurn: 0 }
}

/** Tools whose name alone says the command tests or builds. */
const RUNNERS = new Set([
  'vitest',
  'jest',
  'mocha',
  'ava',
  'pytest',
  'tox',
  'nox',
  'rspec',
  'phpunit',
  'ctest',
  'playwright',
  'cypress',
  'tsc',
  'make',
  'ninja',
])
/** Package managers, and the scripts of theirs that test or build. */
const PACKAGE_MANAGERS = new Set(['npm', 'pnpm', 'yarn', 'bun'])
const SCRIPT = /^(test|build|check|typecheck|verify|ci)(:|$)/
/** Toolchains, and the verbs of theirs that test or build. */
const TOOLCHAINS: Readonly<Record<string, readonly string[]>> = {
  cargo: ['test', 'build', 'check', 'nextest'],
  go: ['test', 'build', 'vet'],
  dotnet: ['test', 'build'],
  swift: ['test', 'build'],
  mix: ['test', 'compile'],
  deno: ['test', 'check'],
  zig: ['test', 'build'],
  bazel: ['test', 'build'],
  mvn: ['test', 'verify', 'package', 'install', 'compile'],
  './mvnw': ['test', 'verify', 'package', 'install', 'compile'],
  gradle: ['test', 'build', 'check', 'assemble'],
  './gradlew': ['test', 'build', 'check', 'assemble'],
}
/** Words that only run what follows them. */
const LAUNCHERS = new Set(['npx', 'bunx', 'pnpx', 'exec', 'time', 'sudo'])
const TWO_WORD_LAUNCHERS = new Set([
  'uv run',
  'poetry run',
  'pdm run',
  'pnpm exec',
  'npm exec',
])

/** Whether a shell command runs tests or a build, in any of its steps. */
export function isTestOrBuild(command: string): boolean {
  return command.split(/&&|\|\||[;|\n]/).some(step => testsOrBuilds(words(step)))
}

function testsOrBuilds(step: string[]): boolean {
  const [first, second, third] = step
  if (first === undefined) return false
  if (RUNNERS.has(first)) return true
  if (PACKAGE_MANAGERS.has(first)) {
    const script = second === 'run' ? third : second
    return script !== undefined && (script === 't' || SCRIPT.test(script))
  }
  if (first === 'cmake') return second === '--build'
  if (/^python3?$/.test(first) && second === '-m') {
    return third === 'pytest' || third === 'unittest'
  }
  return second !== undefined && (TOOLCHAINS[first]?.includes(second) ?? false)
}

/** A step's words, without the variables set for it or the launchers running it. */
function words(step: string): string[] {
  const all = step.trim().split(/\s+/).filter(Boolean)
  let i = 0
  while (i < all.length) {
    if (/^\w+=/.test(all[i]!) || LAUNCHERS.has(all[i]!)) i += 1
    else if (TWO_WORD_LAUNCHERS.has(`${all[i]} ${all[i + 1]}`)) i += 2
    else break
  }
  return all.slice(i)
}

/** The treats saved in the store: a whole number, none when it cannot be read. */
export function storedTreats(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : 0
}
