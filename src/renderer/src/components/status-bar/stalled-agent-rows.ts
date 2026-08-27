/**
 * Turns the stall map into rows the status-bar popover can render and act on,
 * one per pane, so the user can continue a single agent instead of the fleet.
 */

import type { AgentStallCause } from '../../../../shared/agent-stall-signature'
import type { AgentStatusEntry, AgentType } from '../../../../shared/agent-status-types'
import type { AgentStallObservation } from '../../../../shared/agent-stall-recovery-policy'
import { agentStallRateLimitResetAt } from '../../../../shared/agent-stall-rate-limit-provider'
import type { RateLimitState } from '../../../../shared/rate-limit-types'
import { parsePaneKey } from '../../../../shared/stable-pane-id'

export type StalledAgentRow = {
  paneKey: string
  worktreeId: string
  worktreeName: string
  agentType: AgentType | null
  cause: AgentStallCause
  /** The matched failure text, for the row's second line. */
  signature: string
  observedAt: number
  /** True while continuing cannot work yet — a provider window that has not
   *  reopened. Kept separate from `resetAt` because "blocked, reset unknown"
   *  and "not blocked" are different answers. */
  blocked: boolean
  /** When the window reopens, when Orca knows it. */
  resetAt: number | null
}

export type StalledAgentRowsState = {
  agentStallByPaneKey: Record<string, AgentStallObservation | undefined>
  agentStatusByPaneKey: Record<string, AgentStatusEntry | undefined>
  tabsByWorktree: Record<string, readonly { id: string }[] | undefined>
  worktreesByRepo: Record<string, readonly { id: string; name?: string }[] | undefined>
  rateLimits?: RateLimitState
}

function buildWorktreeNames(state: StalledAgentRowsState): {
  byTabId: Map<string, string>
  nameById: Map<string, string>
} {
  const byTabId = new Map<string, string>()
  for (const [worktreeId, tabs] of Object.entries(state.tabsByWorktree)) {
    for (const tab of tabs ?? []) {
      byTabId.set(tab.id, worktreeId)
    }
  }
  const nameById = new Map<string, string>()
  for (const worktrees of Object.values(state.worktreesByRepo)) {
    for (const worktree of worktrees ?? []) {
      if (worktree.name) {
        nameById.set(worktree.id, worktree.name)
      }
    }
  }
  return { byTabId, nameById }
}

/** Longest-stalled first: that is the agent that has been waiting on the user. */
export function selectStalledAgentRows(
  state: StalledAgentRowsState,
  now: number
): StalledAgentRow[] {
  const { byTabId, nameById } = buildWorktreeNames(state)
  const rows: StalledAgentRow[] = []

  for (const observation of Object.values(state.agentStallByPaneKey)) {
    if (!observation) {
      continue
    }
    const parsed = parsePaneKey(observation.paneKey)
    const worktreeId = parsed ? (byTabId.get(parsed.tabId) ?? '') : ''
    const agentType = state.agentStatusByPaneKey[observation.paneKey]?.agentType ?? null
    const resetAt =
      observation.cause === 'rate-limit'
        ? agentStallRateLimitResetAt(state.rateLimits, agentType)
        : null
    rows.push({
      paneKey: observation.paneKey,
      worktreeId,
      // Falls back to the id so a row is never nameless while a workspace is
      // still loading its listing.
      worktreeName: nameById.get(worktreeId) ?? worktreeId,
      agentType,
      cause: observation.cause,
      signature: observation.signature,
      observedAt: observation.observedAt,
      // A rate-limit row with no known reset stays blocked — Orca just cannot
      // say for how long, and nudging early spends the turn on a refusal.
      blocked: observation.cause === 'rate-limit' && (resetAt === null || now < resetAt),
      resetAt
    })
  }

  return rows.sort((a, b) => a.observedAt - b.observedAt || a.paneKey.localeCompare(b.paneKey))
}

export function stalledAgentRowsCanContinue(rows: readonly StalledAgentRow[]): boolean {
  return rows.some((row) => !row.blocked)
}
