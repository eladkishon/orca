import type { DashboardCard } from '../../../../shared/dashboard-snapshot'
import type { TuiAgent } from '../../../../shared/tui-agent'

/**
 * What the board shows between asking for something and the snapshot agreeing.
 *
 * The pop-out does not own its own data: every action it offers is relayed to
 * the main window, and the board only changes when the next snapshot comes
 * back. For removal that snapshot is behind a confirm in a window the user is
 * not looking at, so a delete read as having done nothing at all. Starting an
 * agent had the same shape with a longer wait and no confirm to blame.
 *
 * So the board remembers what was asked for and draws it straight away. This
 * is a claim, not a fact — the pruning below is what keeps it honest.
 */

/** Long enough for a confirm answered promptly, short enough that a cancelled
 *  one restores the card while the user is still looking at it. */
export const PENDING_CARD_ACTION_TIMEOUT_MS = 15_000
/** Agents boot slowly, and a placeholder that gives up first is a lie about
 *  something that is still on its way. */
export const PENDING_SPAWN_TIMEOUT_MS = 45_000

export type PendingCardAction = { kind: 'removing' | 'ending'; startedAt: number }

export type PendingSpawn = {
  /** Its own id: two agents can be started in one workspace before either lands. */
  id: string
  worktreeId: string
  agent: TuiAgent
  startedAt: number
  /** What the workspace held when we asked, so the arrival of a new card is
   *  what clears the placeholder rather than a timer. */
  cardCountAtStart: number
}

export function countCardsInWorktree(cards: readonly DashboardCard[], worktreeId: string): number {
  let count = 0
  for (const card of cards) {
    if (card.worktreeId === worktreeId) {
      count += 1
    }
  }
  return count
}

/**
 * Drops a pending action once it has either come true — the card is gone from
 * the snapshot — or waited long enough that it plainly is not going to. A
 * cancelled confirm produces no event at all, so the timeout is the only thing
 * that can put the card back.
 */
export function prunePendingCardActions(
  pending: ReadonlyMap<string, PendingCardAction>,
  cards: readonly DashboardCard[],
  now: number
): Map<string, PendingCardAction> {
  const live = new Set(cards.map((card) => card.paneKey))
  const next = new Map<string, PendingCardAction>()
  for (const [paneKey, action] of pending) {
    if (live.has(paneKey) && now - action.startedAt < PENDING_CARD_ACTION_TIMEOUT_MS) {
      next.set(paneKey, action)
    }
  }
  return next
}

/**
 * Drops a placeholder once its workspace has grown a card it did not have, or
 * once waiting has stopped being plausible.
 */
export function prunePendingSpawns(
  pending: readonly PendingSpawn[],
  cards: readonly DashboardCard[],
  now: number
): PendingSpawn[] {
  return pending.filter((spawn) => {
    if (now - spawn.startedAt >= PENDING_SPAWN_TIMEOUT_MS) {
      return false
    }
    return countCardsInWorktree(cards, spawn.worktreeId) <= spawn.cardCountAtStart
  })
}
