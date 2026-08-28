/**
 * The text fields of a board card, kept out of the snapshot builder.
 *
 * These are all "what does this agent say about itself" decisions — which
 * message is worth showing, which command names the work, why it stopped — and
 * they read better together than scattered through the assembly of a card.
 */

import { agentStallCauseLabel } from '../dashboard-popout/agent-card-stall-reason'
import { isMeaningfulAgentMessage } from '../../../../shared/agent-message-meaningfulness'
import { formatAgentToolPreview } from '@/lib/agent-row-tool-preview'
import type { AgentStallCause } from '../../../../shared/agent-stall-signature'
import { boundedLabel, boundedLabelOrUndefined, nonEmpty, rowTask } from './dashboard-card-labels'
import type { DashboardAgentRow } from './useDashboardData'

export type DashboardCardText = {
  task: string
  activity?: string
  lastUserMessage?: string
  lastAgentMessage?: string
  stallReason?: string
  recentCommands?: string[]
}

export function dashboardCardText(args: {
  row: DashboardAgentRow
  /** A row read only from its terminal title carries synthetic text, never a
   *  real conversation, so none of these fields mean anything for it. */
  isTitleDerived: boolean
  stallCause?: AgentStallCause
}): DashboardCardText {
  const { row, isTitleDerived } = args
  if (isTitleDerived) {
    return { task: '' }
  }
  return {
    task: rowTask(row),
    // Why: the same one-line tool preview the agent list shows, so the two
    // surfaces name the running command identically.
    activity: boundedLabelOrUndefined(nonEmpty(formatAgentToolPreview(row.entry, row.state))),
    lastUserMessage: nonEmpty(row.entry.prompt),
    // Why: labels only — the trail is read, never acted on, so the timestamps
    // it is stored with have no job on the wire.
    ...(row.entry.toolTrail?.length
      ? { recentCommands: row.entry.toolTrail.map((use) => boundedLabel(use.label)) }
      : {}),
    // Why: the field carries whatever the hook last captured, and a bare "Exit
    // code 1" is the shell talking, not the agent — on a card it reads as the
    // agent's current thought.
    lastAgentMessage: isMeaningfulAgentMessage(row.entry.lastAssistantMessage)
      ? nonEmpty(row.entry.lastAssistantMessage)
      : undefined,
    // Why: only a detected cause ships. The common "a command is taking a
    // while" case needs no field — the card names the running tool.
    ...(args.stallCause ? { stallReason: agentStallCauseLabel(args.stallCause) } : {})
  }
}
