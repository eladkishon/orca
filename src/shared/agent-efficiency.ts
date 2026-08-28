/**
 * The two things about an agent's usage that change what you would do.
 *
 * SHARE OF THE WEEK. Not "how many tokens" — nobody has an instinct for a
 * token count — but how much of this week's usage went here. That is the
 * number that says whether a project is worth its budget.
 *
 * RE-SENT CONTEXT. Context arrives either from cache (re-used, billed at a
 * fraction) or as input (sent again at full price). The input share of what a
 * session paid for is the part that caching could have avoided, so it is the
 * one figure here that names something you could actually fix. Output is the
 * agent's own words and cache writes are the investment that makes re-use
 * possible, so neither is waste.
 *
 * Deliberately no step counts: a "step" is an implementation detail of how an
 * agent talks to its provider, and a number nobody can act on is clutter with
 * a decimal point.
 */

export type AgentEfficiencyInput = {
  turns: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  estimatedCostUsd?: number | null
}

export type AgentUsageShare = {
  /** Input + output + cache writes: what the turns actually paid for. */
  billableTokens: number
  /** Cache reads — re-used context, billed at a fraction. */
  reusedTokens: number
  /** 0–1 of this week's billable tokens, or null without a total to divide by. */
  weeklyShare: number | null
  /** 0–1 of THIS row's spend that went on re-sending context. */
  resentShare: number | null
  estimatedCostUsd: number | null
}

/** Past this, re-sent context is a real share of the bill rather than noise. */
const RESENT_WORTH_FIXING = 0.25

export function agentUsageShare(
  input: AgentEfficiencyInput,
  weeklyBillableTotal: number
): AgentUsageShare {
  const billableTokens = input.inputTokens + input.outputTokens + input.cacheWriteTokens
  return {
    billableTokens,
    reusedTokens: input.cacheReadTokens,
    weeklyShare: weeklyBillableTotal > 0 ? billableTokens / weeklyBillableTotal : null,
    resentShare: billableTokens > 0 ? input.inputTokens / billableTokens : null,
    estimatedCostUsd: input.estimatedCostUsd ?? null
  }
}

/** Whether the re-sent share is large enough to be worth telling someone. */
export function isResentShareWorthFixing(share: AgentUsageShare): boolean {
  return share.resentShare !== null && share.resentShare >= RESENT_WORTH_FIXING
}

export function formatPercent(value: number | null): string {
  if (value === null) {
    return '—'
  }
  const percent = value * 100
  // Why a floor of "<1%" rather than "0%": a project that used something did
  // not use nothing, and rounding it to zero says it did.
  if (percent > 0 && percent < 1) {
    return '<1%'
  }
  return `${Math.round(percent)}%`
}

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
