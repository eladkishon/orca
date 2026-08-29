import type { DashboardCard } from '../../../../shared/dashboard-snapshot'

/** Agents boot slowly; past this the split is assumed never to have landed. */
export const PREVIEW_ADOPTION_TIMEOUT_MS = 45_000

/** A split asked for from the preview, waiting for its card to show up. */
export type PreviewSessionAdoption = {
  worktreeId: string
  /** What the workspace already held, so the NEW pane is identifiable. */
  knownPaneKeys: readonly string[]
  startedAt: number
}

/**
 * Matches sessions started from the preview's split chord to the cards the next
 * snapshot brings, so the new agent joins the grid the user is looking at.
 * Nothing here starts anything — it only decides which card was the answer.
 */
export function adoptNewPreviewSessions(
  adoptions: readonly PreviewSessionAdoption[],
  cards: readonly DashboardCard[],
  now: number
): { adoptedPaneKeys: string[]; pending: PreviewSessionAdoption[] } {
  const adoptedPaneKeys: string[] = []
  const pending: PreviewSessionAdoption[] = []
  for (const adoption of adoptions) {
    const match = cards.find(
      (card) =>
        card.worktreeId === adoption.worktreeId &&
        !adoption.knownPaneKeys.includes(card.paneKey) &&
        !adoptedPaneKeys.includes(card.paneKey)
    )
    if (match) {
      adoptedPaneKeys.push(match.paneKey)
    } else if (now - adoption.startedAt < PREVIEW_ADOPTION_TIMEOUT_MS) {
      pending.push(adoption)
    }
  }
  return { adoptedPaneKeys, pending }
}
