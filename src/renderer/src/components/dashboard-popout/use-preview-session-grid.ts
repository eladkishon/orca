import { useCallback, useEffect, useMemo, useState } from 'react'
import { adoptNewPreviewSessions, type PreviewSessionAdoption } from './preview-session-adoption'
import type { DashboardCard } from '../../../../shared/dashboard-snapshot'
import { isTuiAgent } from '../../../../shared/tui-agent-config'
import type { TuiAgent } from '../../../../shared/tui-agent'

/**
 * What the terminal dialog is showing: one agent, or several after the split
 * chord (Cmd/Ctrl+D), which starts another session in the same workspace and
 * puts it beside the one the user was already watching.
 *
 * Only paneKeys are remembered — card data is re-resolved from each fresh
 * snapshot, so a bucket move never closes the dialog. The opened card is kept
 * as a fallback so a vanished pane stays on screen until dismissed, with its
 * live routing cleared because daemon PTY ids can be reused.
 */
export function usePreviewSessionGrid(input: {
  cards: readonly DashboardCard[]
  launchableAgentsByWorktreeId: Record<string, TuiAgent[]> | undefined
  spawnAgent: (worktreeId: string, agent: TuiAgent) => void
}): {
  dialogCards: DashboardCard[]
  openPreviewCards: (cards: readonly DashboardCard[]) => void
  closeDialogCard: (paneKey: string) => void
  handleDialogOpenChange: (open: boolean) => void
  splitPreviewSession: (card: DashboardCard) => void
} {
  const { cards, launchableAgentsByWorktreeId, spawnAgent } = input
  const [openedCards, setOpenedCards] = useState<readonly DashboardCard[]>([])
  const [adoptions, setAdoptions] = useState<readonly PreviewSessionAdoption[]>([])

  const dialogCards = useMemo(
    () =>
      openedCards.map(
        (opened) =>
          cards.find((card) => card.paneKey === opened.paneKey) ?? {
            ...opened,
            ptyId: null,
            leafId: null
          }
      ),
    [cards, openedCards]
  )

  const openPreviewCards = useCallback((next: readonly DashboardCard[]) => {
    setOpenedCards(next)
  }, [])

  const closeDialogCard = useCallback((paneKey: string) => {
    setOpenedCards((previous) => previous.filter((card) => card.paneKey !== paneKey))
  }, [])

  const handleDialogOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setOpenedCards([])
    }
  }, [])

  const splitPreviewSession = useCallback(
    (card: DashboardCard) => {
      // The agent already running here is the least surprising thing to start.
      const agent = isTuiAgent(card.agentType)
        ? card.agentType
        : launchableAgentsByWorktreeId?.[card.worktreeId]?.[0]
      if (!agent) {
        return
      }
      setAdoptions((previous) => [
        ...previous,
        {
          worktreeId: card.worktreeId,
          knownPaneKeys: cards
            .filter((other) => other.worktreeId === card.worktreeId)
            .map((other) => other.paneKey),
          startedAt: Date.now()
        }
      ])
      spawnAgent(card.worktreeId, agent)
    },
    [cards, launchableAgentsByWorktreeId, spawnAgent]
  )

  useEffect(() => {
    if (adoptions.length === 0) {
      return
    }
    const { adoptedPaneKeys, pending } = adoptNewPreviewSessions(adoptions, cards, Date.now())
    if (adoptedPaneKeys.length > 0) {
      setOpenedCards((previous) => [
        ...previous,
        ...cards.filter(
          (card) =>
            adoptedPaneKeys.includes(card.paneKey) &&
            !previous.some((open) => open.paneKey === card.paneKey)
        )
      ])
    }
    if (pending.length !== adoptions.length) {
      setAdoptions(pending)
    }
  }, [adoptions, cards])

  return {
    dialogCards,
    openPreviewCards,
    closeDialogCard,
    handleDialogOpenChange,
    splitPreviewSession
  }
}
