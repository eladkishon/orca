import { createAgentStallDetector } from '../../../../shared/agent-stall-detector'
import { isResumableTuiAgent } from '../../../../shared/agent-session-resume'
import type {
  RuntimePtyTitleTrackerEntry,
  RuntimePtyWorktreeRecord
} from '../../runtime-terminal-state-records'

/** Coarse on purpose: the dashboard's stall threshold is minutes, so a fact every
 *  few seconds is plenty and a busy fleet does not flood the channel. */
const OUTPUT_ACTIVITY_FACT_INTERVAL_MS = 5_000

/**
 * Why in main and not the renderer: this is the only place every byte of a local/SSH pane is
 * parsed, hidden panes included. A stalled fleet is by definition mostly hidden panes, so a
 * renderer-side scan saw only the one pane that happened to be on screen.
 */
export function pushAgentStallOutputFacts(
  entry: RuntimePtyTitleTrackerEntry,
  pty: RuntimePtyWorktreeRecord | null,
  cleanData: string,
  consumerAvailable: boolean
): void {
  // Why lazily: the pane's agent is often unknown when the tracker is built — a
  // launched agent's record fills in later, a hand-typed one only as foregroundAgent.
  if (!entry.agentStallDetector && consumerAvailable) {
    const agent = pty?.launchAgent ?? pty?.foregroundAgent ?? null
    if (agent && isResumableTuiAgent(agent)) {
      entry.agentStallDetector = createAgentStallDetector()
    }
  }
  const agentStall = entry.agentStallDetector?.observe(cleanData)
  if (agentStall) {
    entry.pendingFacts.push({
      kind: 'agent-stall',
      cause: agentStall.cause,
      signature: agentStall.signature
    })
  }
  const activityAt = Date.now()
  if (activityAt - entry.lastOutputActivityFactAt >= OUTPUT_ACTIVITY_FACT_INTERVAL_MS) {
    entry.lastOutputActivityFactAt = activityAt
    entry.pendingFacts.push({ kind: 'output-activity' })
  }
}
