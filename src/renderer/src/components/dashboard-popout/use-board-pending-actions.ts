import { useCallback, useEffect, useState } from 'react'
import {
  prunePendingCardActions,
  prunePendingSpawns,
  countCardsInWorktree,
  type PendingCardAction,
  type PendingSpawn
} from './board-pending-actions'
import type { DashboardCard } from '../../../../shared/dashboard-snapshot'
import type { TuiAgent } from '../../../../shared/tui-agent'

let nextSpawnId = 0

/**
 * Wraps the board's relayed actions so each one shows on screen the moment it
 * is asked for, and unwinds itself if the snapshot never agrees.
 *
 * The wrappers still call through unchanged — nothing here decides anything,
 * it only decides what the board draws while the real work happens elsewhere.
 */
export function useBoardPendingActions(input: {
  cards: readonly DashboardCard[]
  onRemoveWorkspace: (card: DashboardCard) => void
  onEndSession: (card: DashboardCard) => void
  onSpawnAgent: (worktreeId: string, agent: TuiAgent, prompt?: string) => void
}): {
  pendingByPaneKey: ReadonlyMap<string, PendingCardAction>
  pendingSpawns: readonly PendingSpawn[]
  removeWorkspace: (card: DashboardCard) => void
  endSession: (card: DashboardCard) => void
  spawnAgent: (worktreeId: string, agent: TuiAgent) => void
} {
  const { cards, onRemoveWorkspace, onEndSession, onSpawnAgent } = input
  const [pendingByPaneKey, setPendingByPaneKey] = useState<ReadonlyMap<string, PendingCardAction>>(
    () => new Map()
  )
  const [pendingSpawns, setPendingSpawns] = useState<readonly PendingSpawn[]>([])
  // Why a tick as well as the snapshot: a cancelled confirm changes nothing at
  // all, so without a clock the card would stay greyed out forever.
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const now = Date.now()
    setPendingByPaneKey((previous) =>
      previous.size === 0 ? previous : prunePendingCardActions(previous, cards, now)
    )
    setPendingSpawns((previous) =>
      previous.length === 0 ? previous : prunePendingSpawns(previous, cards, now)
    )
  }, [cards, tick])

  useEffect(() => {
    if (pendingByPaneKey.size === 0 && pendingSpawns.length === 0) {
      return
    }
    const timer = setInterval(() => setTick((value) => value + 1), 1_000)
    return () => clearInterval(timer)
  }, [pendingByPaneKey.size, pendingSpawns.length])

  const markPending = useCallback((card: DashboardCard, kind: PendingCardAction['kind']) => {
    setPendingByPaneKey((previous) =>
      new Map(previous).set(card.paneKey, { kind, startedAt: Date.now() })
    )
  }, [])

  const removeWorkspace = useCallback(
    (card: DashboardCard) => {
      markPending(card, 'removing')
      onRemoveWorkspace(card)
    },
    [markPending, onRemoveWorkspace]
  )

  const endSession = useCallback(
    (card: DashboardCard) => {
      markPending(card, 'ending')
      onEndSession(card)
    },
    [markPending, onEndSession]
  )

  const spawnAgent = useCallback(
    (worktreeId: string, agent: TuiAgent, prompt?: string) => {
      nextSpawnId += 1
      setPendingSpawns((previous) => [
        ...previous,
        {
          id: `spawn-${nextSpawnId}`,
          worktreeId,
          agent,
          startedAt: Date.now(),
          cardCountAtStart: countCardsInWorktree(cards, worktreeId)
        }
      ])
      onSpawnAgent(worktreeId, agent, prompt)
    },
    [cards, onSpawnAgent]
  )

  return { pendingByPaneKey, pendingSpawns, removeWorkspace, endSession, spawnAgent }
}
