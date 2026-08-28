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

/** Adds up the usage of several worktrees — a project's columns' worth. */
export function sumWorktreeUsage(
  byWorktree: Map<string, AgentEfficiencyInput>,
  worktreeIds: readonly string[]
): AgentEfficiencyInput | undefined {
  let matched = false
  const total: AgentEfficiencyInput = {
    turns: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0
  }
  // Why de-duplicated: several agents can share one worktree, and counting its
  // usage once per agent would multiply the project's spend by its headcount.
  for (const worktreeId of new Set(worktreeIds)) {
    const usage = byWorktree.get(worktreeId)
    if (!usage) {
      continue
    }
    matched = true
    total.turns += usage.turns
    total.inputTokens += usage.inputTokens
    total.outputTokens += usage.outputTokens
    total.cacheReadTokens += usage.cacheReadTokens
    total.cacheWriteTokens += usage.cacheWriteTokens
  }
  return matched ? total : undefined
}
