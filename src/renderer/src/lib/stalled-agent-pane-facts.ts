/**
 * Reads the store facts the stall-recovery policy needs for each pane that
 * reported a login/network failure.
 *
 * Kept separate from the policy so the decision stays pure, and narrow in its
 * state shape so it can be exercised without building a whole app store.
 */

import {
  AGENT_STATUS_STALE_AFTER_MS,
  type AgentStatusEntry
} from '../../../shared/agent-status-types'
import type { AgentStallRecoveryPaneFacts } from '../../../shared/agent-stall-recovery-policy'
import { isTerminalLeafId, parsePaneKey } from '../../../shared/stable-pane-id'
import { isExplicitAgentStatusFresh } from '@/lib/pane-agent-evidence'

export type StalledAgentPaneFactsState = {
  tabsByWorktree: Record<string, readonly { id: string; launchAgent?: string | null }[] | undefined>
  terminalLayoutsByTabId: Record<
    string,
    { ptyIdsByLeafId?: Record<string, string | undefined> } | undefined
  >
  agentStatusByPaneKey: Record<string, AgentStatusEntry | undefined>
  paneForegroundAgentByPaneKey: Record<
    string,
    { agent: string | null; shellForeground: boolean } | undefined
  >
}

function buildWorktreeIdByTabId(state: StalledAgentPaneFactsState): Map<string, string> {
  const worktreeIdByTabId = new Map<string, string>()
  for (const [worktreeId, tabs] of Object.entries(state.tabsByWorktree)) {
    for (const tab of tabs ?? []) {
      worktreeIdByTabId.set(tab.id, worktreeId)
    }
  }
  return worktreeIdByTabId
}

function findTab(
  state: StalledAgentPaneFactsState,
  worktreeId: string,
  tabId: string
): { id: string; launchAgent?: string | null } | undefined {
  return (state.tabsByWorktree[worktreeId] ?? []).find((tab) => tab.id === tabId)
}

/**
 * Why the foreground row wins: it is process-table evidence read at shell
 * command boundaries, so it knows the agent exited even when the last hook row
 * still says `done`. Absent evidence is treated as "agent still there" — the
 * nudge path is guarded by the runtime's own `sendable` check, which refuses
 * and reports `no-agent` rather than typing into a bare shell.
 */
function resolveAgentProcessLive(
  foreground: { agent: string | null; shellForeground: boolean } | undefined
): boolean {
  if (!foreground) {
    return true
  }
  if (foreground.shellForeground) {
    return false
  }
  return true
}

export function collectStalledAgentPaneFacts(
  state: StalledAgentPaneFactsState,
  paneKeys: readonly string[],
  now: number
): Record<string, AgentStallRecoveryPaneFacts> {
  const worktreeIdByTabId = buildWorktreeIdByTabId(state)
  const facts: Record<string, AgentStallRecoveryPaneFacts> = {}

  for (const paneKey of paneKeys) {
    const parsed = parsePaneKey(paneKey)
    if (!parsed) {
      continue
    }
    const worktreeId = worktreeIdByTabId.get(parsed.tabId)
    if (!worktreeId) {
      // The tab is gone; the policy reports this as an unknown pane.
      continue
    }
    const tab = findTab(state, worktreeId, parsed.tabId)
    const statusEntry = state.agentStatusByPaneKey[paneKey]
    const foreground = state.paneForegroundAgentByPaneKey[paneKey]
    const statusIsFresh = Boolean(
      statusEntry && isExplicitAgentStatusFresh(statusEntry, now, AGENT_STATUS_STALE_AFTER_MS)
    )
    facts[paneKey] = {
      worktreeId,
      agent: foreground?.agent ?? statusEntry?.agentType ?? tab?.launchAgent ?? null,
      status: statusIsFresh ? (statusEntry?.state ?? null) : null,
      lastOutputAt: statusEntry?.updatedAt ?? null,
      agentProcessLive: resolveAgentProcessLive(foreground),
      // Why a bound PTY and not just a live tab: recovery types into the pane's
      // terminal, and an unbound leaf has none to type into.
      addressable: Boolean(
        isTerminalLeafId(parsed.leafId) &&
        state.terminalLayoutsByTabId[parsed.tabId]?.ptyIdsByLeafId?.[parsed.leafId]
      )
    }
  }

  return facts
}
