/**
 * The columns a board actually shows, which are no longer one per bucket.
 *
 * "Done" and "Idle" are the same thing to a person scanning: not running. They
 * were two columns because the column WAS the state signal — now the card's
 * ring and its activity badge carry that, so splitting them buys a second
 * heading and costs a third of the board's width.
 *
 * They stay separate buckets on the wire and in the filters, where the
 * distinction is real: a finished agent nobody has looked at yet is not the
 * same as one that has been acknowledged. Inside the lane, unacknowledged work
 * still sorts first, and the ring still tells them apart.
 */

import { DASHBOARD_BUCKET_ORDER, type DashboardBucket } from '../../../../shared/dashboard-snapshot'

export type DashboardLane = {
  id: DashboardBucket
  /** Buckets drawn in this column, in the order they should read. */
  buckets: DashboardBucket[]
}

export function dashboardLanes(showIdle: boolean): DashboardLane[] {
  const lanes: DashboardLane[] = []
  for (const bucket of DASHBOARD_BUCKET_ORDER) {
    if (bucket === 'idle') {
      if (showIdle) {
        // Why: appended rather than given a column — idle IS done, seen.
        lanes.at(-1)?.buckets.push('idle')
      }
      continue
    }
    lanes.push({ id: bucket, buckets: [bucket] })
  }
  return lanes
}
