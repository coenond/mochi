import { defineConfig } from 'vitest/config'

// Vitest runs the core's `*.spec.ts`. The engine's `claude plugin test` owns `*.test.ts(x)`.
export default defineConfig({
  test: { include: ['src/**/*.spec.ts'] },
})
