/**
 * The recent tool calls of one agent, kept so a card can show its progress.
 *
 * A card can say what an agent is doing right now, but not whether it is
 * getting anywhere — and "right now" is useless when the answer is a
 * twenty-minute command or a fan-out of subagents. The trail of what it just
 * did is the cheapest possible answer: no model, no terminal, just the tool
 * calls the status hooks already report.
 */

/** Short enough to stay a glance, long enough to show a direction. */
export const AGENT_TOOL_TRAIL_MAX = 6

export type AgentToolUse = {
  /** "Bash: pnpm test" — the same shape the card's command line uses. */
  label: string
  at: number
}

/**
 * Appends a tool call, ignoring repeats of the one already at the head.
 * Agents re-report the same tool on every status ping, so without that the
 * trail would be six copies of one command.
 */
export function appendAgentToolUse(
  history: readonly AgentToolUse[] | undefined,
  label: string | undefined,
  at: number
): AgentToolUse[] | undefined {
  const trimmed = label?.trim()
  const existing = history ?? []
  if (!trimmed || existing.at(-1)?.label === trimmed) {
    return history as AgentToolUse[] | undefined
  }
  const appended = [...existing, { label: trimmed, at }]
  return appended.length > AGENT_TOOL_TRAIL_MAX
    ? appended.slice(appended.length - AGENT_TOOL_TRAIL_MAX)
    : appended
}
