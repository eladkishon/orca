import { describe, expect, it } from 'vitest'
import { sumWorktreeUsage, usageByWorktreeId, type WorktreeUsageRow } from './usage-by-worktree'

function row(key: string, turns: number): WorktreeUsageRow {
  return {
    key,
    turns,
    inputTokens: turns * 10,
    outputTokens: turns * 2,
    cacheReadTokens: turns * 100,
    cacheWriteTokens: turns
  }
}

describe('usageByWorktreeId', () => {
  it('indexes the rows the scan attributed to a worktree', () => {
    const index = usageByWorktreeId([row('worktree:w1', 3), row('worktree:w2', 5)])

    expect(index.get('w1')?.turns).toBe(3)
    expect(index.get('w2')?.turns).toBe(5)
  })

  it('leaves unattributed rows out rather than guessing an owner', () => {
    // Real usage, but not this card's — folding it in anywhere would be a guess.
    const index = usageByWorktreeId([row('cwd:/tmp/somewhere', 9), row('unscoped', 4)])

    expect(index.size).toBe(0)
  })
})

describe('sumWorktreeUsage', () => {
  it('adds up the worktrees a project has on the board', () => {
    const index = usageByWorktreeId([row('worktree:w1', 3), row('worktree:w2', 5)])

    expect(sumWorktreeUsage(index, ['w1', 'w2'])?.turns).toBe(8)
  })

  it('counts a shared worktree once, not once per agent', () => {
    // Several agents can live in one worktree; counting per agent would
    // multiply a project's spend by its headcount.
    const index = usageByWorktreeId([row('worktree:w1', 3)])

    expect(sumWorktreeUsage(index, ['w1', 'w1', 'w1'])?.turns).toBe(3)
  })

  it('reports nothing when no worktree matched, rather than a row of zeros', () => {
    const index = usageByWorktreeId([row('worktree:w1', 3)])

    expect(sumWorktreeUsage(index, ['other'])).toBeUndefined()
  })
})
