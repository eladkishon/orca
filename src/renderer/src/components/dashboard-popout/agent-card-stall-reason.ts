/**
 * Why a stalled agent is stalled, in the two or three words a card can hold.
 *
 * A still ring says "not advancing"; it cannot say whether the agent is logged
 * out, waiting on a dead network, or three minutes into a legitimate build. The
 * first two want you now, the third wants you to leave it alone, so the card
 * has to tell them apart.
 *
 * Detected causes come from the stall detector, which reads them off the
 * agent's own output. Everything else falls back to the tool that is running,
 * because "waiting on Bash" is already most of the answer.
 */

import { translate } from '@/i18n/i18n'

/** Detected causes, already narrowed by the stall detector. */
export type AgentCardStallCause = 'auth' | 'network' | 'rate-limit'

export function agentStallCauseLabel(cause: AgentCardStallCause): string {
  switch (cause) {
    case 'auth':
      return translate('dashboardPopout.card.stall.auth', 'Logged out')
    case 'network':
      return translate('dashboardPopout.card.stall.network', 'Network')
    case 'rate-limit':
      return translate('dashboardPopout.card.stall.rateLimit', 'Rate limited')
  }
}

/**
 * The label for a card whose ring has stopped. `activity` is the "Bash: pnpm
 * test" line the card already shows, so the running tool needs no extra field.
 */
export function agentCardStallReason(card: { stallReason?: string; activity?: string }): string {
  if (card.stallReason) {
    return card.stallReason
  }
  const tool = card.activity?.split(':')[0]?.trim()
  return tool
    ? translate('dashboardPopout.card.stall.waitingOn', 'Waiting on {{tool}}', { tool })
    : translate('dashboardPopout.card.stall.quiet', 'No output')
}
