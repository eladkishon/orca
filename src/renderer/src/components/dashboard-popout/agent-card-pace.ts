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

/** Past this, a build or a download would normally have said something.
 *  The board's setting overrides it; this is what an unset one means. */
export const AGENT_PACE_STALLED_MS = 3 * 60_000
/** Warn a quarter of the way in: long enough that an ordinary tool call cannot
 *  trip it, early enough to be a warning rather than a verdict. */
export const AGENT_PACE_SLOW_FRACTION = 0.25

export type DashboardCardPace = 'advancing' | 'slow' | 'stalled'

/** What the board's setting offers, in minutes. 0 is "Never": some fleets run
 *  long builds all day and a board that cries wolf is one you stop reading. */
export const AGENT_STALL_MINUTE_OPTIONS = [0, 1, 3, 10] as const

/** The stored setting as a threshold. Unset means the built-in default, so the
 *  board behaves the same for everyone who never opened the menu. */
export function dashboardStallAfterMs(minutes: number | undefined): number {
  return typeof minutes === 'number' && Number.isFinite(minutes) && minutes >= 0
    ? Math.round(minutes * 60_000)
    : AGENT_PACE_STALLED_MS
}

/**
 * Only a working agent has a pace. A finished or waiting one is quiet on
 * purpose, and colouring that as stuck would cry wolf on every idle card.
 */
export function dashboardCardPace(
  card: Pick<
    DashboardCard,
    'dotState' | 'workingMode' | 'unseen' | 'statusUpdatedAt' | 'stateChangedAt'
  >,
  now: number,
  /** Silence a card is allowed before it counts as stalled. Zero or less turns
   *  the treatment off, which is what the board's "Never" setting means. */
  stalledMs: number = AGENT_PACE_STALLED_MS
): DashboardCardPace {
  if (stalledMs <= 0 || dashboardCardDisplayState(card) !== 'working') {
    return 'advancing'
  }
  // Why: fall back to when the state began. A snapshot from a client that does
  // not send statusUpdatedAt would otherwise read as stalled from birth.
  const lastHeardFrom = card.statusUpdatedAt || card.stateChangedAt
  if (!lastHeardFrom) {
    return 'advancing'
  }
  const quietMs = now - lastHeardFrom
  if (quietMs >= stalledMs) {
    return 'stalled'
  }
  return quietMs >= stalledMs * AGENT_PACE_SLOW_FRACTION ? 'slow' : 'advancing'
}
