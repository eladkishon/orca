/**
 * Whether a working agent is actually advancing.
 *
 * "Working" only means the agent last told us it was working. An agent waiting
 * on a hung network call, a slow install or a command that will never return
 * reports exactly the same state as one making progress every second — so the
 * board cannot distinguish a fleet that is moving from one that is stuck.
 *
 * Every hook update stamps `statusUpdatedAt`, and a live agent stamps one on
 * each tool call, so silence is the signal. This reads that silence; the
 * stylesheet turns it into the card's beam.
 */

import type { DashboardCard } from '../../../../shared/dashboard-snapshot'
import { dashboardCardDisplayState } from '../../../../shared/dashboard-snapshot'

/** Long enough that an ordinary tool call cannot trip it. */
export const AGENT_PACE_SLOW_MS = 45_000
/** Past this, a build or a download would normally have said something. */
export const AGENT_PACE_STALLED_MS = 3 * 60_000

export type DashboardCardPace = 'advancing' | 'slow' | 'stalled'

/**
 * Only a working agent has a pace. A finished or waiting one is quiet on
 * purpose, and colouring that as stuck would cry wolf on every idle card.
 */
export function dashboardCardPace(
  card: Pick<
    DashboardCard,
    'dotState' | 'workingMode' | 'unseen' | 'statusUpdatedAt' | 'stateChangedAt'
  >,
  now: number
): DashboardCardPace {
  if (dashboardCardDisplayState(card) !== 'working') {
    return 'advancing'
  }
  // Why: fall back to when the state began. A snapshot from a client that does
  // not send statusUpdatedAt would otherwise read as stalled from birth.
  const lastHeardFrom = card.statusUpdatedAt || card.stateChangedAt
  if (!lastHeardFrom) {
    return 'advancing'
  }
  const quietMs = now - lastHeardFrom
  if (quietMs >= AGENT_PACE_STALLED_MS) {
    return 'stalled'
  }
  return quietMs >= AGENT_PACE_SLOW_MS ? 'slow' : 'advancing'
}
