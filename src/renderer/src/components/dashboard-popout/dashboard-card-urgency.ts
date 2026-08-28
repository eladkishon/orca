/**
 * Orders the cards inside a project column.
 *
 * The board used to split state into columns. It no longer needs to: the
 * card's ring says needs-you, working, stalled or done, and its badge says what
 * kind of work that is. What the columns were really buying was ORDER — the
 * agent that wants something first, the finished ones out of the way — and
 * order survives without spending a column on it.
 *
 * So the state still decides where a card sits; it just sits in its project's
 * column now, sorted rather than segregated.
 */

import { DASHBOARD_BUCKET_ORDER, type DashboardCard } from '../../../../shared/dashboard-snapshot'

const BUCKET_RANK = new Map(DASHBOARD_BUCKET_ORDER.map((bucket, index) => [bucket, index]))

export function sortCardsByUrgency(cards: readonly DashboardCard[]): DashboardCard[] {
  return [...cards].sort((first, second) => {
    const rank = (BUCKET_RANK.get(first.bucket) ?? 0) - (BUCKET_RANK.get(second.bucket) ?? 0)
    // Why: within a state, most-recently-moved first — a card that just landed
    // in a state is the one you have not seen yet.
    return rank === 0 ? second.stateChangedAt - first.stateChangedAt : rank
  })
}
