/**
 * Turns raw token counts into the one question a board can answer at a glance:
 * is this agent's work costing what it should?
 *
 * Only what the usage scan records is used. Nothing estimates, and where a
 * signal is not measured the verdict says so rather than guessing.
 *
 * BILLABLE tokens, not total. Cache reads are context re-used at a fraction of
 * the price, and they dwarf everything else — a "total tokens" figure is mostly
 * cache reads, which makes every agent look enormous and none of them look
 * different from each other. Input, output and cache WRITES are what a turn
 * actually costs.
 *
 * The same trap sank the first version of the reuse rate: read ÷ (read + input)
 * is ~100% for every agent alive, so it graded everyone identically. Reuse is
 * still reported, because a genuinely cold session is worth seeing, but it is
 * not what separates a cheap agent from an expensive one.
 *
 * What does separate them is BILLABLE TOKENS PER STEP: how much new context
 * each step pays for. That is the number that differs between a tight session
 * and one dragging a bloated window through every call.
 */

export type AgentEfficiencyInput = {
  turns: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  /** From the usage scan when it could price the model; absent otherwise. */
  estimatedCostUsd?: number | null
}

export type AgentEfficiencyGrade = 'efficient' | 'mixed' | 'costly' | 'unknown'

export type AgentEfficiency = {
  grade: AgentEfficiencyGrade
  /** Input + output + cache writes. What the turns actually cost. */
  billableTokens: number
  /** Cache reads: context re-used rather than re-sent. */
  reusedTokens: number
  /** 0–1, or null when nothing was sent or read. */
  cacheReuseRate: number | null
  /** Billable context per step — the figure that tells agents apart. */
  billablePerTurn: number | null
  estimatedCostUsd: number | null
  /** One plain sentence naming the biggest thing to fix. */
  headline: string
}

/** Above this, each step is paying for a large amount of fresh context. */
const HEAVY_STEP_TOKENS = 25_000
/** Above this it is not a heavy step, it is a runaway one. */
const RUNAWAY_STEP_TOKENS = 60_000
/** Below this, the session is re-sending context instead of re-using it. */
const COLD_CACHE_BELOW = 0.7

export function agentEfficiency(input: AgentEfficiencyInput): AgentEfficiency {
  const billableTokens = input.inputTokens + input.outputTokens + input.cacheWriteTokens
  const reusedTokens = input.cacheReadTokens
  const contextTokens = reusedTokens + input.inputTokens
  const cacheReuseRate = contextTokens > 0 ? reusedTokens / contextTokens : null
  const billablePerTurn = input.turns > 0 ? Math.round(billableTokens / input.turns) : null
  const estimatedCostUsd = input.estimatedCostUsd ?? null
  const base = {
    billableTokens,
    reusedTokens,
    cacheReuseRate,
    billablePerTurn,
    estimatedCostUsd
  }

  if (billablePerTurn === null || billableTokens === 0) {
    return { ...base, grade: 'unknown', headline: 'Not enough recorded activity to judge.' }
  }
  if (billablePerTurn > RUNAWAY_STEP_TOKENS) {
    return {
      ...base,
      grade: 'costly',
      headline: 'Each step pays for a very large amount of fresh context.'
    }
  }
  if (cacheReuseRate !== null && cacheReuseRate < COLD_CACHE_BELOW) {
    return {
      ...base,
      grade: 'costly',
      headline: 'Context is being re-sent rather than re-used, which pays full price each turn.'
    }
  }
  if (billablePerTurn > HEAVY_STEP_TOKENS) {
    return {
      ...base,
      grade: 'mixed',
      headline: 'Cache is working, but each step still pays for a lot of new context.'
    }
  }
  return { ...base, grade: 'efficient', headline: 'Small steps on re-used context.' }
}

/** Compact token count for a dense badge: 1.2M, 340k, 900. */
export function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(tokens >= 10_000_000 ? 0 : 1)}M`
  }
  if (tokens >= 1_000) {
    return `${Math.round(tokens / 1_000)}k`
  }
  return String(tokens)
}

export function formatCostUsd(cost: number): string {
  return cost >= 10 ? `$${Math.round(cost)}` : `$${cost.toFixed(2)}`
}
