/**
 * Turns the stall map into rows the status-bar popover can render and act on,
 * one per pane, so the user can continue a single agent instead of the fleet.
 */

import type { AgentStallCause } from '../../../../shared/agent-stall-signature'
import type { AgentStatusEntry, AgentType } from '../../../../shared/agent-status-types'
import type {
  AgentStallObservation,
  AgentStallRecoveryLedgerEntry
} from '../../../../shared/agent-stall-recovery-policy'
import { agentStallRateLimitResetAt } from '../../../../shared/agent-stall-rate-limit-provider'
import type { RateLimitState } from '../../../../shared/rate-limit-types'
import { parsePaneKey } from '../../../../shared/stable-pane-id'
import type { AppState } from '@/store/types'
import { findKnownWorktreeById } from '@/store/slices/worktrees/listing/detected-worktree-meta'

/** How long a continued agent stays listed. Recovery clears the stall the
 *  instant it succeeds, so without this the status bar blinks for a few seconds
 *  and the user only ever sees agents reviving by themselves. */
export const AGENT_STALL_RECENTLY_CONTINUED_MS = 2 * 60 * 1000

export type StalledAgentRow = {
  paneKey: string
  /** The tab that owns the pane, so a row can open the session it names. */
  tabId: string | null
  worktreeId: string
  /** Null when the workspace is not in the store at all — better a session
   *  title than a bare uuid. */
  worktreeName: string | null
  /** The project the stalled pane belongs to — a bare workspace name is
   *  ambiguous the moment two projects hold a branch of the same name. */
  projectName: string | null
  /** The agent's own session name, so a workspace running several agents says
   *  which one stopped. */
  agentName: string | null
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
  /** Set when this agent was already continued — the row is history, not a
   *  pane still waiting. Null while it is genuinely stalled. */
  continuedAt: number | null
}

export type StalledAgentRowsState = {
  agentStallByPaneKey: Record<string, AgentStallObservation | undefined>
  agentStatusByPaneKey: Record<string, AgentStatusEntry | undefined>
  agentStallRecoveryLedgerByPaneKey: Record<string, AgentStallRecoveryLedgerEntry | undefined>
  tabsByWorktree: Record<string, readonly { id: string }[] | undefined>
  repos?: readonly { id: string; displayName?: string }[]
  rateLimits?: RateLimitState
} & Pick<AppState, 'worktreesByRepo' | 'detectedWorktreesByRepo' | 'folderWorkspaces'>

function buildWorktreeNames(state: StalledAgentRowsState): {
  byTabId: Map<string, string>
  nameById: Map<string, string>
  projectByWorktreeId: Map<string, string>
  projectNameByRepoId: Map<string, string>
} {
  const byTabId = new Map<string, string>()
  for (const [worktreeId, tabs] of Object.entries(state.tabsByWorktree)) {
    for (const tab of tabs ?? []) {
      byTabId.set(tab.id, worktreeId)
    }
  }
  const nameById = new Map<string, string>()
  const projectNameByRepoId = new Map(
    (state.repos ?? []).map((repo) => [repo.id, repo.displayName ?? repo.id])
  )
  const projectByWorktreeId = new Map<string, string>()
  for (const [repoId, worktrees] of Object.entries(state.worktreesByRepo)) {
    for (const worktree of worktrees ?? []) {
      if (worktree.displayName) {
        nameById.set(worktree.id, worktree.displayName)
      }
      projectByWorktreeId.set(worktree.id, projectNameByRepoId.get(repoId) ?? repoId)
    }
  }
  return { byTabId, nameById, projectByWorktreeId, projectNameByRepoId }
}

/** Folder workspaces and detected worktrees never reach `worktreesByRepo`, so
 *  the popover has to fall back to the wider lookup or it prints a bare id. */
function findKnownWorktreeName(
  state: StalledAgentRowsState,
  worktreeId: string
): { name: string | null; repoId: string | null } {
  const known = worktreeId
    ? findKnownWorktreeById(
        {
          worktreesByRepo: state.worktreesByRepo ?? {},
          detectedWorktreesByRepo: state.detectedWorktreesByRepo ?? {},
          folderWorkspaces: state.folderWorkspaces ?? []
        },
        worktreeId
      )
    : undefined
  const name =
    known?.displayName?.trim() || known?.path?.trim().split(/[\\/]/).findLast(Boolean) || null
  return { name, repoId: known?.repoId ?? null }
}

/** What the pane was doing, in the one line the row can hold: its own name when
 *  it has one, else the prompt it stopped on. */
function stalledAgentName(status: AgentStatusEntry | undefined): string | null {
  const named =
    status?.orchestration?.displayName?.trim() ||
    status?.orchestration?.taskTitle?.trim() ||
    status?.terminalTitle?.trim()
  if (named) {
    return named
  }
  const prompt = status?.prompt?.trim().split('\n')[0]?.trim()
  return prompt ? (prompt.length > 60 ? `${prompt.slice(0, 59)}…` : prompt) : null
}

/** Longest-stalled first: that is the agent that has been waiting on the user.
 *  Agents already continued sort after the ones still waiting. */
export function selectStalledAgentRows(
  state: StalledAgentRowsState,
  now: number
): StalledAgentRow[] {
  const { byTabId, nameById, projectByWorktreeId, projectNameByRepoId } = buildWorktreeNames(state)

  const buildRow = (
    paneKey: string,
    cause: AgentStallCause,
    signature: string,
    observedAt: number,
    continuedAt: number | null
  ): StalledAgentRow => {
    const parsed = parsePaneKey(paneKey)
    const worktreeId = parsed ? (byTabId.get(parsed.tabId) ?? '') : ''
    const status = state.agentStatusByPaneKey[paneKey]
    const agentType = status?.agentType ?? null
    const resetAt =
      cause === 'rate-limit' ? agentStallRateLimitResetAt(state.rateLimits, agentType) : null
    const known = nameById.has(worktreeId)
      ? { name: nameById.get(worktreeId) ?? null, repoId: null }
      : findKnownWorktreeName(state, worktreeId)
    return {
      paneKey,
      tabId: parsed?.tabId ?? null,
      worktreeId,
      worktreeName: known.name,
      projectName:
        projectByWorktreeId.get(worktreeId) ??
        (known.repoId ? (projectNameByRepoId.get(known.repoId) ?? null) : null),
      agentName: stalledAgentName(status),
      agentType,
      cause,
      signature,
      observedAt,
      // A rate-limit row with no known reset stays blocked — Orca just cannot
      // say for how long, and nudging early spends the turn on a refusal.
      blocked:
        continuedAt === null && cause === 'rate-limit' && (resetAt === null || now < resetAt),
      resetAt,
      continuedAt
    }
  }

  const rows = Object.values(state.agentStallByPaneKey)
    .filter((observation): observation is AgentStallObservation => Boolean(observation))
    .map((observation) =>
      buildRow(
        observation.paneKey,
        observation.cause,
        observation.signature,
        observation.observedAt,
        null
      )
    )

  // Recovery deletes the stall the moment it lands, so what just happened is
  // only legible from the ledger it deliberately keeps.
  for (const [paneKey, entry] of Object.entries(state.agentStallRecoveryLedgerByPaneKey)) {
    if (!entry || state.agentStallByPaneKey[paneKey]) {
      continue
    }
    if (now - entry.lastAttemptAt > AGENT_STALL_RECENTLY_CONTINUED_MS) {
      continue
    }
    rows.push(buildRow(paneKey, entry.cause, '', entry.lastAttemptAt, entry.lastAttemptAt))
  }

  return rows.sort(
    (a, b) =>
      Number(a.continuedAt !== null) - Number(b.continuedAt !== null) ||
      a.observedAt - b.observedAt ||
      a.paneKey.localeCompare(b.paneKey)
  )
}

/** Agents still waiting on the user, as opposed to ones already continued. */
export function stalledAgentRowsPending(rows: readonly StalledAgentRow[]): StalledAgentRow[] {
  return rows.filter((row) => row.continuedAt === null)
}

export function stalledAgentRowsCanContinue(rows: readonly StalledAgentRow[]): boolean {
  return rows.some((row) => row.continuedAt === null && !row.blocked)
}
