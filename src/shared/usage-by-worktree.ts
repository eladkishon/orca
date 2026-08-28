/**
 * Finds the usage a board card or project column is responsible for.
 *
 * The usage scan already attributes each turn to a worktree — its project rows
 * are keyed `worktree:<id>` — so this is an exact lookup rather than a name
 * match. That matters: a fuzzy match between "the project called X" and "the
 * directory called X" would quietly attribute one project's spend to another,
 * and nobody reading a token count would know it had happened.
 *
 * Rows the scan could not attribute to a worktree are left out entirely. They
 * are real usage, but not this card's, and folding them in anywhere would be a
 * guess wearing a number's clothes.
 */

import type { AgentEfficiencyInput } from './agent-efficiency'

export type WorktreeUsageRow = AgentEfficiencyInput & { key: string }

const WORKTREE_KEY_PREFIX = 'worktree:'

export function usageByWorktreeId(
  rows: readonly WorktreeUsageRow[] | undefined
): Map<string, AgentEfficiencyInput> {
  const byWorktree = new Map<string, AgentEfficiencyInput>()
  for (const row of rows ?? []) {
    if (!row.key.startsWith(WORKTREE_KEY_PREFIX)) {
      continue
    }
    byWorktree.set(row.key.slice(WORKTREE_KEY_PREFIX.length), row)
  }
  return byWorktree
}

export type WorktreeUsageTotal = {
  usage: AgentEfficiencyInput
  /** How many distinct worktrees contributed. */
  worktreeCount: number
}

/**
 * Adds up the usage of several worktrees — a project's worth.
 *
 * Reports the count as well as the total, because a project summing ONE
 * worktree is not a summary of anything: it is that worktree's own figure with
 * a different label on it, and showing both invites the reader to believe two
 * independent measurements agree.
 */
export function sumWorktreeUsage(
  byWorktree: Map<string, AgentEfficiencyInput>,
  worktreeIds: readonly string[]
): WorktreeUsageTotal | undefined {
  let worktreeCount = 0
  const usage: AgentEfficiencyInput = {
    turns: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0
  }
  // Why de-duplicated: several agents can share one worktree, and counting its
  // usage once per agent would multiply the project's spend by its headcount.
  for (const worktreeId of new Set(worktreeIds)) {
    const worktreeUsage = byWorktree.get(worktreeId)
    if (!worktreeUsage) {
      continue
    }
    worktreeCount += 1
    usage.turns += worktreeUsage.turns
    usage.inputTokens += worktreeUsage.inputTokens
    usage.outputTokens += worktreeUsage.outputTokens
    usage.cacheReadTokens += worktreeUsage.cacheReadTokens
    usage.cacheWriteTokens += worktreeUsage.cacheWriteTokens
  }
  return worktreeCount > 0 ? { usage, worktreeCount } : undefined
}
