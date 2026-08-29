import { describe, expect, it } from 'vitest'
import {
  sumRepoUsage,
  sumWorktreeUsage,
  usageByWorktreeId,
  type WorktreeUsageRow
} from './usage-by-worktree'

function row(key: string, turns: number, repoId?: string): WorktreeUsageRow {
  return {
    key,
    repoId: repoId ?? null,
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

    expect(sumWorktreeUsage(index, ['w1', 'w2'])?.usage.turns).toBe(8)
    expect(sumWorktreeUsage(index, ['w1', 'w2'])?.worktreeCount).toBe(2)
  })

  it('counts a shared worktree once, not once per agent', () => {
    // Several agents can live in one worktree; counting per agent would
    // multiply a project's spend by its headcount.
    const index = usageByWorktreeId([row('worktree:w1', 3)])

    expect(sumWorktreeUsage(index, ['w1', 'w1', 'w1'])?.usage.turns).toBe(3)
    // One worktree is not a summary of anything — the caller needs to know.
    expect(sumWorktreeUsage(index, ['w1', 'w1', 'w1'])?.worktreeCount).toBe(1)
  })

  it('reports nothing when no worktree matched, rather than a row of zeros', () => {
    const index = usageByWorktreeId([row('worktree:w1', 3)])

    expect(sumWorktreeUsage(index, ['other'])).toBeUndefined()
  })
})

describe('sumRepoUsage', () => {
  it('totals every worktree of the repo, not only the ones with a card', () => {
    // The bug this fixes: a project summing only its carded worktrees reported
    // that one card's own figure back as a project total, so both badges
    // printed the same percentage.
    const rows = [
      row('worktree:w1', 3, 'r1'),
      row('worktree:idle', 5, 'r1'),
      row('worktree:other', 7, 'r2')
    ]

    expect(sumRepoUsage(rows, 'r1')?.usage.turns).toBe(8)
    expect(sumRepoUsage(rows, 'r1')?.worktreeCount).toBe(2)
  })

  it('adds up cost rather than dropping it', () => {
    const rows: WorktreeUsageRow[] = [
      { ...row('worktree:w1', 1, 'r1'), estimatedCostUsd: 2 },
      { ...row('worktree:w2', 1, 'r1'), estimatedCostUsd: 3 }
    ]

    expect(sumRepoUsage(rows, 'r1')?.usage.estimatedCostUsd).toBe(5)
  })

  it('reports nothing for a repo the scan never attributed', () => {
    expect(sumRepoUsage([row('worktree:w1', 3, 'r1')], 'r2')).toBeUndefined()
  })
})
