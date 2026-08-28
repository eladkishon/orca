import { describe, expect, it } from 'vitest'
import {
  countCardsInWorktree,
  PENDING_CARD_ACTION_TIMEOUT_MS,
  PENDING_SPAWN_TIMEOUT_MS,
  prunePendingCardActions,
  prunePendingSpawns,
  type PendingSpawn
} from './board-pending-actions'
import type { DashboardCard } from '../../../../shared/dashboard-snapshot'

function card(paneKey: string, worktreeId: string): DashboardCard {
  return { paneKey, worktreeId } as DashboardCard
}

describe('prunePendingCardActions', () => {
  const pending = new Map([['pane-1', { kind: 'removing' as const, startedAt: 1_000 }]])

  it('keeps the claim while the card is still there and the wait is reasonable', () => {
    const next = prunePendingCardActions(pending, [card('pane-1', 'w1')], 3_000)

    expect(next.get('pane-1')?.kind).toBe('removing')
  })

  it('forgets the claim once the snapshot agrees the card is gone', () => {
    expect(prunePendingCardActions(pending, [], 3_000).size).toBe(0)
  })

  it('restores the card when nothing happened', () => {
    // A cancelled confirm sends no event, so only the timeout can undo this.
    const next = prunePendingCardActions(
      pending,
      [card('pane-1', 'w1')],
      1_000 + PENDING_CARD_ACTION_TIMEOUT_MS
    )

    expect(next.size).toBe(0)
  })
})

describe('prunePendingSpawns', () => {
  const spawn: PendingSpawn = {
    id: 'spawn-1',
    worktreeId: 'w1',
    agent: 'claude' as PendingSpawn['agent'],
    startedAt: 1_000,
    cardCountAtStart: 1
  }

  it('keeps the placeholder until the workspace grows a card', () => {
    expect(prunePendingSpawns([spawn], [card('pane-1', 'w1')], 2_000)).toHaveLength(1)
  })

  it('drops it the moment the real card arrives', () => {
    const cards = [card('pane-1', 'w1'), card('pane-2', 'w1')]

    expect(prunePendingSpawns([spawn], cards, 2_000)).toHaveLength(0)
  })

  it('gives up once the agent plainly is not coming', () => {
    const later = 1_000 + PENDING_SPAWN_TIMEOUT_MS

    expect(prunePendingSpawns([spawn], [card('pane-1', 'w1')], later)).toHaveLength(0)
  })

  it('ignores cards in other workspaces', () => {
    expect(countCardsInWorktree([card('pane-9', 'w2')], 'w1')).toBe(0)
  })
})
