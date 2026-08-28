import { describe, expect, it } from 'vitest'
import { sortCardsByUrgency } from './dashboard-card-urgency'
import type { DashboardCard } from '../../../../shared/dashboard-snapshot'

function card(paneKey: string, bucket: string, stateChangedAt = 0): DashboardCard {
  return { paneKey, bucket, stateChangedAt } as unknown as DashboardCard
}

describe('sortCardsByUrgency', () => {
  it('puts the agents that want something first, and the finished ones last', () => {
    const sorted = sortCardsByUrgency([
      card('d', 'idle'),
      card('c', 'done'),
      card('b', 'working'),
      card('a', 'attention')
    ])

    expect(sorted.map((entry) => entry.paneKey)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('puts the most recently moved first within one state', () => {
    const sorted = sortCardsByUrgency([
      card('older', 'working', 100),
      card('newer', 'working', 900)
    ])

    expect(sorted.map((entry) => entry.paneKey)).toEqual(['newer', 'older'])
  })

  it('leaves the input array alone', () => {
    const input = [card('b', 'done'), card('a', 'attention')]
    sortCardsByUrgency(input)

    expect(input.map((entry) => entry.paneKey)).toEqual(['b', 'a'])
  })
})
