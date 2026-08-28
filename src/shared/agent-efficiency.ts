/**
 * Turns raw token counts into the one question a board can answer at a glance:
 * is this agent's work costing what it should?
 *
 * Only what the usage scan already records is used here. Nothing estimates,
 * nothing is invented, and where a signal genuinely is not measured the verdict
 * says so rather than guessing — a confident-looking number nobody can trace is
 * worse than an honest gap.
 *
 * Two signals do the work:
 *
 * CACHE REUSE. A turn that reads cache is re-using context already paid for; a
 * turn that reads none re-sends the whole conversation. This is the closest
 * thing to a "context bloat" measurement that exists in the data, and it is a
 * real one rather than a proxy: cold turns cost full price every time.
 *
 * TOKENS PER TURN. How much context each step carries. High means a large
 * window is being dragged through every step, which is what makes a long
 * session expensive even when the work is small.
 */

export type AgentEfficiencyInput = {
  turns: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
}

export type AgentEfficiencyGrade = 'efficient' | 'mixed' | 'costly' | 'unknown'

export type AgentEfficiency = {
  grade: AgentEfficiencyGrade
  /** 0–1, or null when nothing was read or sent at all. */
  cacheReuseRate: number | null
  /** Context carried per step, or null without turns to divide by. */
  tokensPerTurn: number | null
  totalTokens: number
  /** One plain sentence naming the biggest thing to fix, or what is going well. */
  headline: string
}

/** Below this, most turns are paying full price for context already sent. */
const COLD_CACHE_BELOW = 0.5
/** Above this, each step is dragging a large window with it. */
const HEAVY_TURN_TOKENS = 120_000

export function agentEfficiency(input: AgentEfficiencyInput): AgentEfficiency {
  const totalTokens =
    input.inputTokens + input.outputTokens + input.cacheReadTokens + input.cacheWriteTokens
  // Why this denominator: cache READ is context reused, input is context sent
  // afresh. Output is the agent's own words and belongs to neither.
  const contextTokens = input.cacheReadTokens + input.inputTokens
  const cacheReuseRate = contextTokens > 0 ? input.cacheReadTokens / contextTokens : null
  const tokensPerTurn = input.turns > 0 ? Math.round(totalTokens / input.turns) : null

  if (totalTokens === 0 || cacheReuseRate === null || tokensPerTurn === null) {
    return {
      grade: 'unknown',
      cacheReuseRate,
      tokensPerTurn,
      totalTokens,
      headline: 'Not enough recorded activity to judge.'
    }
  }

  const coldCache = cacheReuseRate < COLD_CACHE_BELOW
  const heavyTurns = tokensPerTurn > HEAVY_TURN_TOKENS
  if (coldCache && heavyTurns) {
    return {
      grade: 'costly',
      cacheReuseRate,
      tokensPerTurn,
      totalTokens,
      headline: 'Large context, re-sent most turns — the expensive combination.'
    }
  }
  if (coldCache) {
    return {
      grade: 'mixed',
      cacheReuseRate,
      tokensPerTurn,
      totalTokens,
      headline: 'Context is re-sent more often than it is reused.'
    }
  }
  if (heavyTurns) {
    return {
      grade: 'mixed',
      cacheReuseRate,
      tokensPerTurn,
      totalTokens,
      headline: 'Cache is working, but each step carries a large context.'
    }
  }
  return {
    grade: 'efficient',
    cacheReuseRate,
    tokensPerTurn,
    totalTokens,
    headline: 'Context is being reused and each step stays small.'
  }
}

/** Compact token count for a dense table: 1.2M, 340k, 900. */
export function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(tokens >= 10_000_000 ? 0 : 1)}M`
  }
  if (tokens >= 1_000) {
    return `${Math.round(tokens / 1_000)}k`
  }
  return String(tokens)
}
