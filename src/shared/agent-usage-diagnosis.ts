/**
 * Turns a cost split into the one thing worth doing about it.
 *
 * The finding that shapes this file: across every project measured, re-sent
 * input is ~0.0% of the bill and cache reads are 75–85% of it. So the question
 * "how much context is being sent again" was answering a rounding error. The
 * question that matters is "how much context rides along on every turn",
 * because that figure is multiplied by the turn count and paid every time.
 *
 * OVER THE THRESHOLD. Past 200k of context, cache reads bill at double rate.
 * A session that crosses it pays twice per turn for the whole context, so this
 * outranks everything else.
 *
 * HEAVY CONTEXT. Below the cliff but still large. Every unused skill, tool
 * definition and instruction file in that base context is billed on each turn,
 * so trimming it is multiplied by however many turns follow.
 *
 * Anything else is an agent doing its job, and saying so is more useful than
 * inventing an action for a number that is already fine.
 */

import {
  LONG_CONTEXT_THRESHOLD_TOKENS,
  formatCostUsd,
  formatPercent,
  formatTokenCount,
  totalCostUsd,
  type AgentEfficiencyInput
} from './agent-efficiency'

export type UsageDiagnosisId = 'over-threshold' | 'heavy-context' | 'healthy'

export type UsageDiagnosis = {
  id: UsageDiagnosisId
  /** Cache-read tokens per turn: context carried into every turn. */
  contextPerTurn: number | null
  /** 0–1 of cost spent carrying context in and out of cache. */
  contextCostShare: number | null
}

/**
 * Below the cliff, this much context per turn is still worth a look. Set well
 * under the threshold so a repo trending toward the cliff is flagged before it
 * arrives rather than after.
 */
const HEAVY_CONTEXT_TOKENS = 100_000

export function diagnoseUsage(usage: AgentEfficiencyInput): UsageDiagnosis {
  const contextPerTurn = usage.turns > 0 ? usage.cacheReadTokens / usage.turns : null
  const cost = totalCostUsd(usage)
  const split = usage.costUsd
  const contextCostShare = split && cost ? (split.cacheRead + split.cacheWrite) / cost : null
  if (contextPerTurn !== null && contextPerTurn >= LONG_CONTEXT_THRESHOLD_TOKENS) {
    return { id: 'over-threshold', contextPerTurn, contextCostShare }
  }
  if (contextPerTurn !== null && contextPerTurn >= HEAVY_CONTEXT_TOKENS) {
    return { id: 'heavy-context', contextPerTurn, contextCostShare }
  }
  return { id: 'healthy', contextPerTurn, contextCostShare }
}

export type UsageFixPromptContext = {
  diagnosis: UsageDiagnosis
  usage: AgentEfficiencyInput
  /** What the figures describe, so the agent knows its own subject. */
  scopeLabel: string
  /** Earliest day the numbers cover, when the scan knows it. */
  sinceDay?: string | undefined
}

/**
 * The prompt handed to the agent, carrying every number the reader just saw.
 *
 * Why the full split rather than "your context is too big": the agent lands in
 * a repo with no access to this popover, and a complaint it cannot verify is a
 * prompt it can only guess at. It is also pointed at the specific places base
 * context comes from, because the usage scan reads token counts only — it
 * cannot see what is IN the context, so finding that out is the agent's job.
 * English rather than the UI language: these are instructions to a coding
 * agent, not text for a person.
 */
export function buildUsageFixPrompt({
  diagnosis,
  usage,
  scopeLabel,
  sinceDay
}: UsageFixPromptContext): string {
  const cost = totalCostUsd(usage)
  const split = usage.costUsd
  const costLine = (label: string, amount: number | undefined): string =>
    amount === undefined || cost === null || cost === 0
      ? `- ${label}: n/a`
      : `- ${label}: ${formatCostUsd(amount)} (${formatPercent(amount / cost)} of spend)`
  const lines = [
    `Find out what is sitting in the base context of ${scopeLabel} and what it costs.`,
    '',
    `Recorded usage${sinceDay ? ` since ${sinceDay}` : ''}:`,
    `- Turns: ${usage.turns.toLocaleString()}`,
    `- Context carried into every turn: ${
      diagnosis.contextPerTurn === null
        ? 'n/a'
        : `${formatTokenCount(Math.round(diagnosis.contextPerTurn))} tokens`
    }`,
    ...(cost === null ? [] : [`- Total cost: ${formatCostUsd(cost)}`]),
    costLine('Cache reads (context re-read each turn)', split?.cacheRead),
    costLine('Cache writes', split?.cacheWrite),
    costLine('Output', split?.output),
    costLine('Input (context sent uncached)', split?.input),
    `- Cache read tokens: ${formatTokenCount(usage.cacheReadTokens)}`,
    `- Output tokens: ${formatTokenCount(usage.outputTokens)}`,
    ''
  ]
  if (diagnosis.id === 'over-threshold') {
    lines.push(
      `This is over the ${formatTokenCount(LONG_CONTEXT_THRESHOLD_TOKENS)} long-context threshold, where cache reads bill at DOUBLE rate. Every turn pays twice for the whole context. Getting under the threshold is worth more than any other change here.`
    )
  } else if (diagnosis.id === 'heavy-context') {
    lines.push(
      `Every token of base context is re-read and re-billed on each of these ${usage.turns.toLocaleString()} turns, whether or not anything in it is used. Trimming it is multiplied by the turn count.`
    )
  } else {
    lines.push(
      'The context per turn looks reasonable. Confirm that from the repo and say so plainly if there is nothing worth changing, rather than inventing work.'
    )
  }
  lines.push(
    '',
    'Orca measures token COUNTS only — it cannot see what is inside the context. Work that out from the repo and the agent configuration:',
    '- Skills: which are exposed to this repo, and which have never actually been invoked. Every skill description sits in base context on every turn.',
    '- MCP servers: their tool definitions are loaded up front and are frequently the single largest block. List the configured servers and which of their tools are actually called here.',
    '- CLAUDE.md / AGENTS.md: total size, including any files they import. These load on every turn.',
    '- Anything auto-loaded at session start: hooks output, system-prompt additions, large files pulled in by convention.',
    '',
    'Report the estimated token size of each, rank them by size, and say which are unused or rarely used. Propose specific cuts with an estimated saving per turn and across the turn count above. Do not change anything until I agree.'
  )
  return lines.join('\n')
}
