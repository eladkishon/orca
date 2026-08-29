/**
 * What an agent's usage costs, and the one number that moves it.
 *
 * SHARE OF SPEND. Not "how many tokens" — nobody has an instinct for a token
 * count — and not a share of tokens either, which is a different question with
 * a different answer. Cache reads are billed at a tenth of input and routinely
 * run a hundred times larger, so they are ~78% of a real bill while looking
 * like rounding error in a token split. Shares here are computed on dollars.
 *
 * CONTEXT PER TURN. Cache reads divided by turns: how much context is carried
 * into every single turn. This is the lever. A base context of skills, tool
 * definitions and instruction files is re-read — and re-billed — on every turn
 * whether or not anything in it gets used, so its size multiplies by the turn
 * count. It is also the number that says whether a session is over the
 * long-context threshold, where the rate doubles.
 *
 * Deliberately no step counts: a "step" is an implementation detail of how an
 * agent talks to its provider, and a number nobody can act on is clutter with
 * a decimal point.
 */

import type { UsageCostSplit } from './claude-usage-types'

export type AgentEfficiencyInput = {
  turns: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  estimatedCostUsd?: number | null
  /** Dollars per token class. Absent from an older host, which is why every
   *  reader here falls back to token counts rather than showing nothing. */
  costUsd?: UsageCostSplit | null
}

/**
 * Anthropic bills cache reads above this context size at double the rate, so
 * crossing it is a real cliff rather than a gradual slope.
 */
export const LONG_CONTEXT_THRESHOLD_TOKENS = 200_000

export type AgentUsageShare = {
  /** Every token the turns touched, cache reads included. */
  totalTokens: number
  /** Cache reads — context carried in again, cheap per token but never free. */
  reusedTokens: number
  /** 0–1 of all recorded spend, by cost when priced and tokens otherwise. */
  spendShare: number | null
  /** Cache-read tokens per turn: the context carried into every turn. */
  contextPerTurn: number | null
  /** Whether that context is over the rate-doubling threshold. */
  overLongContextThreshold: boolean
  estimatedCostUsd: number | null
}

export function totalCostUsd(input: AgentEfficiencyInput): number | null {
  if (input.estimatedCostUsd != null) {
    return input.estimatedCostUsd
  }
  const split = input.costUsd
  return split ? split.input + split.output + split.cacheRead + split.cacheWrite : null
}

/** Every token the turns touched. Cache reads belong in it: they are billed. */
export function totalTokens(input: AgentEfficiencyInput): number {
  return input.inputTokens + input.outputTokens + input.cacheWriteTokens + input.cacheReadTokens
}

export function agentUsageShare(
  input: AgentEfficiencyInput,
  /** All recorded spend to measure against — dollars where the host prices it. */
  total: { costUsd: number | null; tokens: number }
): AgentUsageShare {
  const cost = totalCostUsd(input)
  const tokens = totalTokens(input)
  // Cost first, tokens only when the host never priced anything: a token share
  // answers a question nobody asked, but it beats an em dash.
  const spendShare =
    cost !== null && total.costUsd
      ? cost / total.costUsd
      : total.tokens > 0
        ? tokens / total.tokens
        : null
  const contextPerTurn = input.turns > 0 ? input.cacheReadTokens / input.turns : null
  return {
    totalTokens: tokens,
    reusedTokens: input.cacheReadTokens,
    spendShare,
    contextPerTurn,
    overLongContextThreshold:
      contextPerTurn !== null && contextPerTurn >= LONG_CONTEXT_THRESHOLD_TOKENS,
    estimatedCostUsd: cost
  }
}

export function formatPercent(value: number | null): string {
  if (value === null) {
    return '—'
  }
  const percent = value * 100
  if (percent === 0) {
    return '0%'
  }
  if (percent < 0.01) {
    return '<0.01%'
  }
  // Precision follows size: measured against everything, one long-running repo
  // takes most of the total and the rest land in decimals. A single "<1%"
  // bucket rendered a project and its own worktree as the same string.
  const decimals = percent >= 10 ? 0 : percent >= 1 ? 1 : 2
  return `${percent.toFixed(decimals)}%`
}

export function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000_000_000) {
    return `${(tokens / 1_000_000_000).toFixed(tokens >= 10_000_000_000 ? 0 : 1)}B`
  }
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(tokens >= 10_000_000 ? 0 : 1)}M`
  }
  if (tokens >= 1_000) {
    return `${Math.round(tokens / 1_000)}k`
  }
  return String(tokens)
}

export function formatCostUsd(cost: number): string {
  if (cost >= 1_000) {
    return `$${Math.round(cost).toLocaleString()}`
  }
  return cost >= 10 ? `$${Math.round(cost)}` : `$${cost.toFixed(2)}`
}
