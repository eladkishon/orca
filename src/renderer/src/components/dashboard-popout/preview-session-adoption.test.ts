import { describe, expect, it } from 'vitest'
import {
  adoptNewPreviewSessions,
  PREVIEW_ADOPTION_TIMEOUT_MS,
  type PreviewSessionAdoption
} from './preview-session-adoption'
import type { DashboardCard } from '../../../../shared/dashboard-snapshot'

function card(paneKey: string, worktreeId: string): DashboardCard {
  return { paneKey, worktreeId } as DashboardCard
}

const adoption = (overrides: Partial<PreviewSessionAdoption> = {}): PreviewSessionAdoption => ({
  worktreeId: 'w1',
  knownPaneKeys: ['a'],
  startedAt: 0,
  ...overrides
})

describe('adoptNewPreviewSessions', () => {
  it('adopts the card the workspace did not have', () => {
    const result = adoptNewPreviewSessions(
      [adoption()],
      [card('a', 'w1'), card('b', 'w1'), card('c', 'w2')],
      1_000
    )
    expect(result).toEqual({ adoptedPaneKeys: ['b'], pending: [] })
  })

  it('gives two splits in one workspace a card each', () => {
    const result = adoptNewPreviewSessions(
      [adoption(), adoption()],
      [card('a', 'w1'), card('b', 'w1'), card('c', 'w1')],
      1_000
    )
    expect(result.adoptedPaneKeys).toEqual(['b', 'c'])
  })

  it('keeps waiting while nothing new has landed, then gives up', () => {
    const cards = [card('a', 'w1')]
    expect(adoptNewPreviewSessions([adoption()], cards, 1_000).pending).toHaveLength(1)
    expect(
      adoptNewPreviewSessions([adoption()], cards, PREVIEW_ADOPTION_TIMEOUT_MS + 1).pending
    ).toHaveLength(0)
  })
})
