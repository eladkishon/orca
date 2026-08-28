import type { AgentDotState } from '../worktree/agent-row-display'

// Port of the desktop board's pace read (dashboard-popout/agent-card-pace.ts).
// "Working" only means the agent last said it was working; a live one stamps an
// update on every tool call, so silence is the signal.

/** Long enough that an ordinary tool call cannot trip it. */
export const AGENT_PACE_SLOW_MS = 45_000
/** Past this, a build or a download would normally have said something. */
export const AGENT_PACE_STALLED_MS = 3 * 60_000

export type AgentCardPace = 'advancing' | 'slow' | 'stalled'

/** Only a working agent has a pace — a finished or waiting one is quiet on purpose. */
export function agentCardPace(
  card: { dotState: AgentDotState; updatedAt: number },
  now: number
): AgentCardPace {
  if (card.dotState !== 'working') {
    return 'advancing'
  }
  if (!card.updatedAt) {
    return 'advancing'
  }
  const quietMs = now - card.updatedAt
  if (quietMs >= AGENT_PACE_STALLED_MS) {
    return 'stalled'
  }
  return quietMs >= AGENT_PACE_SLOW_MS ? 'slow' : 'advancing'
}

/**
 * Why a stalled agent is stalled, in the two or three words a card can hold.
 * Mobile has no stall detector, so the running tool answers it: "waiting on
 * Bash" is already most of the answer.
 */
export function agentCardStallReason(card: { activity?: string }): string {
  const tool = card.activity?.split(':')[0]?.trim()
  return tool ? `Waiting on ${tool}` : 'No output'
}
