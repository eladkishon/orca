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

import { totalCostUsd, totalTokens, type AgentEfficiencyInput } from './agent-efficiency'
import type { UsageCostSplit } from './claude-usage-types'

function emptyCostSplit(): UsageCostSplit {
  return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
}

/** Adds one row's cost into a running split. Returns whether anything priced,
 *  so a total built entirely from unpriced rows reports null rather than $0. */
function addCost(into: UsageCostSplit, row: AgentEfficiencyInput): boolean {
  if (!row.costUsd) {
    return false
  }
  into.input += row.costUsd.input
  into.output += row.costUsd.output
  into.cacheRead += row.costUsd.cacheRead
  into.cacheWrite += row.costUsd.cacheWrite
  return true
}

export type WorktreeUsageRow = AgentEfficiencyInput & { key: string; repoId?: string | null }

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
  let priced = false
  const costUsd = emptyCostSplit()
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
    priced = addCost(costUsd, worktreeUsage) || priced
  }
  usage.costUsd = priced ? costUsd : null
  return worktreeCount > 0 ? { usage, worktreeCount } : undefined
}

/**
 * A whole project's usage: every worktree the scan attributed to the repo, not
 * only the ones with an agent on the board right now.
 *
 * Why this and not "sum the cards' worktrees": a project whose board shows one
 * card would otherwise report that card's own figure back as a project total,
 * so the two badges printed the same number and neither said anything the other
 * did not. Summing by repo is what makes the project figure a different
 * measurement rather than a relabelled one.
 */
export function sumRepoUsage(
  rows: readonly WorktreeUsageRow[] | undefined,
  repoId: string
): WorktreeUsageTotal | undefined {
  let worktreeCount = 0
  let priced = false
  let cost: number | null = null
  const costUsd = emptyCostSplit()
  const usage: AgentEfficiencyInput = {
    turns: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0
  }
  for (const row of rows ?? []) {
    if (row.repoId !== repoId || !row.key.startsWith(WORKTREE_KEY_PREFIX)) {
      continue
    }
    worktreeCount += 1
    usage.turns += row.turns
    usage.inputTokens += row.inputTokens
    usage.outputTokens += row.outputTokens
    usage.cacheReadTokens += row.cacheReadTokens
    usage.cacheWriteTokens += row.cacheWriteTokens
    priced = addCost(costUsd, row) || priced
    if (row.estimatedCostUsd != null) {
      cost = (cost ?? 0) + row.estimatedCostUsd
    }
  }
  usage.estimatedCostUsd = cost
  usage.costUsd = priced ? costUsd : null
  return worktreeCount > 0 ? { usage, worktreeCount } : undefined
}

/**
 * Everything the scan recorded, as the totals a share is measured against.
 *
 * Both are returned because they answer differently: cache reads are ~78% of a
 * bill and ~98% of the tokens, so ranking projects by one or the other gives
 * different orders. Cost is the real one; tokens exist only for a host that
 * never priced anything.
 */
export function sumAllUsage(rows: readonly WorktreeUsageRow[] | undefined): {
  costUsd: number | null
  tokens: number
} {
  let costUsd: number | null = null
  let tokens = 0
  for (const row of rows ?? []) {
    tokens += totalTokens(row)
    const rowCost = totalCostUsd(row)
    if (rowCost !== null) {
      costUsd = (costUsd ?? 0) + rowCost
    }
  }
  return { costUsd, tokens }
}
