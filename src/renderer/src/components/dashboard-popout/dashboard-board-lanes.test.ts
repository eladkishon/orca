import { describe, expect, it } from 'vitest'
import { dashboardLanes } from './dashboard-board-lanes'

describe('dashboardLanes', () => {
  it('gives idle no column of its own', () => {
    // Done and idle are the same thing to someone scanning: not running.
    expect(dashboardLanes(true)).toEqual([
      { id: 'attention', buckets: ['attention'] },
      { id: 'working', buckets: ['working'] },
      { id: 'done', buckets: ['done', 'idle'] }
    ])
  })

  it('drops idle entirely when the setting hides it', () => {
    expect(dashboardLanes(false)).toEqual([
      { id: 'attention', buckets: ['attention'] },
      { id: 'working', buckets: ['working'] },
      { id: 'done', buckets: ['done'] }
    ])
  })

  it('reads done before idle, so unacknowledged work sorts first', () => {
    expect(dashboardLanes(true).at(-1)?.buckets).toEqual(['done', 'idle'])
  })
})
