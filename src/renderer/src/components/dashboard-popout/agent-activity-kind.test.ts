import { describe, expect, it } from 'vitest'
import { agentActivityKind } from './agent-activity-kind'

describe('agentActivityKind', () => {
  it('names the kind of work behind a tool', () => {
    expect(agentActivityKind('Edit: src/app.tsx')).toBe('writing')
    expect(agentActivityKind('Read: src/app.tsx')).toBe('reading')
    expect(agentActivityKind('Grep: useEffect')).toBe('searching')
    expect(agentActivityKind('WebFetch: https://example.test')).toBe('browsing')
    expect(agentActivityKind('Task: review the diff')).toBe('delegating')
    expect(agentActivityKind('AskUserQuestion')).toBe('asking')
  })

  it('classifies the command, not just the shell', () => {
    // Nearly every agent funnels its real work through Bash, so "running a
    // command" would be true of half the board and worth nothing.
    expect(agentActivityKind('Bash: pnpm vitest run src/app.test.ts')).toBe('testing')
    expect(agentActivityKind('Bash: pnpm tsc --noEmit')).toBe('building')
    expect(agentActivityKind('Bash: git commit -m "wip"')).toBe('versioning')
    expect(agentActivityKind('Bash: curl https://example.test')).toBe('browsing')
    expect(agentActivityKind('Bash: rg useEffect src/')).toBe('searching')
  })

  it('falls back to running for a command it cannot place', () => {
    expect(agentActivityKind('Bash: ./deploy.sh')).toBe('running')
  })

  it('does not mistake a path, a hostname or a filename for the command', () => {
    // ".test" is a TLD, "src/build" is where it works, "app.test.ts" is a file.
    expect(agentActivityKind('Bash: curl https://example.test')).toBe('browsing')
    expect(agentActivityKind('Bash: cd src/build && ./run.sh')).toBe('running')
    expect(agentActivityKind('Read: src/build/index.ts')).toBe('reading')
  })

  it('calls an unknown tool thinking rather than guessing', () => {
    expect(agentActivityKind('SomeNewTool: whatever')).toBe('thinking')
  })

  it('has nothing to say when no tool is running', () => {
    expect(agentActivityKind(undefined)).toBeUndefined()
    expect(agentActivityKind('  ')).toBeUndefined()
  })
})
