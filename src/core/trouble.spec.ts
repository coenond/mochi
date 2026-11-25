import { describe, expect, it } from 'vitest'

import {
  isTestOrBuild,
  NO_TROUBLE,
  noticeToolCall,
  storedTreats,
  turnStarted,
  type ToolCallEnd,
  type Trouble,
} from './trouble'

const failed = (tool = 'Read', command?: string): ToolCallEnd => ({
  tool,
  command,
  outcome: 'error',
})
const passed = (command: string): ToolCallEnd => ({
  tool: 'Bash',
  command,
  outcome: 'answered',
})

describe('isTestOrBuild', () => {
  it.each([
    'pnpm test',
    'npm test',
    'npm run test:unit',
    'yarn build',
    'bun run typecheck',
    'pnpm check',
    'npx vitest run',
    'vitest',
    'jest --watch=false',
    'pytest -q tests/',
    'python -m pytest',
    'uv run pytest',
    'cargo test',
    'cargo build --release',
    'go test ./...',
    'go build .',
    'make',
    'make test',
    'tsc -p tsconfig.json',
    'dotnet test',
    'mvn verify',
    './gradlew build',
    'cd app && pnpm test',
    'CI=1 pnpm test',
    'cmake --build build',
  ])('%s is a test or build command', command => {
    expect(isTestOrBuild(command)).toBe(true)
  })

  it.each([
    'ls',
    'git status',
    'cat test.txt',
    'echo build',
    'pnpm install',
    'npm run dev',
    'go run .',
    'rm -rf build',
    'grep -r test src',
  ])('%s is not', command => {
    expect(isTestOrBuild(command)).toBe(false)
  })
})

describe('noticeToolCall', () => {
  it('a failing tool call is trouble: the pet is worried', () => {
    expect(noticeToolCall(NO_TROUBLE, failed())).toEqual({
      trouble: { isPending: true, thisTurn: 1 },
      reaction: 'worried',
      isWin: false,
    })
  })

  it('more trouble in the same turn is counted', () => {
    const once = noticeToolCall(NO_TROUBLE, failed()).trouble

    expect(noticeToolCall(once, failed('Bash', 'pnpm test')).trouble.thisTurn).toBe(2)
  })

  it('a new turn starts the count over, the trouble still pending', () => {
    const trouble: Trouble = { isPending: true, thisTurn: 3 }

    expect(turnStarted(trouble)).toEqual({ isPending: true, thisTurn: 0 })
  })

  it('a test or build passing after trouble is a win: it celebrates', () => {
    const trouble: Trouble = { isPending: true, thisTurn: 2 }

    expect(noticeToolCall(trouble, passed('pnpm test'))).toEqual({
      trouble: NO_TROUBLE,
      reaction: 'celebrating',
      isWin: true,
    })
  })

  it('a test or build passing with no trouble before is no win', () => {
    expect(noticeToolCall(NO_TROUBLE, passed('pnpm test'))).toEqual({
      trouble: NO_TROUBLE,
      reaction: null,
      isWin: false,
    })
  })

  it('any other command passing after trouble is no win', () => {
    const trouble: Trouble = { isPending: true, thisTurn: 1 }

    expect(noticeToolCall(trouble, passed('ls'))).toEqual({
      trouble,
      reaction: null,
      isWin: false,
    })
  })

  it('the owner refusing a permission is confusion, not trouble', () => {
    const call: ToolCallEnd = { tool: 'Bash', command: 'rm x', outcome: 'refusedByOwner' }

    expect(noticeToolCall(NO_TROUBLE, call)).toEqual({
      trouble: NO_TROUBLE,
      reaction: 'confused',
      isWin: false,
    })
  })

  it.each(['refused', 'interrupted'] as const)(
    'a call %s with nobody asked goes by unnoticed',
    outcome => {
      const call: ToolCallEnd = { tool: 'Bash', command: 'pnpm test', outcome }
      const trouble: Trouble = { isPending: true, thisTurn: 1 }

      expect(noticeToolCall(trouble, call)).toEqual({
        trouble,
        reaction: null,
        isWin: false,
      })
    },
  )
})

describe('storedTreats', () => {
  it('reads the treats saved', () => {
    expect(storedTreats(3)).toBe(3)
  })

  it.each([undefined, null, -1, 1.5, '2', Number.NaN])('%s reads as none', value => {
    expect(storedTreats(value)).toBe(0)
  })
})
