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
  tabsByWorktree: Record<string, readonly { id: string }[] | undefined>
  terminalLayoutsByTabId: Record<
    string,
    { ptyIdsByLeafId?: Record<string, string | undefined> } | undefined
  >
  agentStatusByPaneKey: Record<string, AgentStatusEntry | undefined>
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
    const statusEntry = state.agentStatusByPaneKey[paneKey]
    // Why freshness matters: a stale `working` row would fence recovery off a
    // pane forever, and a stalled pane stops producing hook events by definition.
    const statusIsFresh = Boolean(
      statusEntry && isExplicitAgentStatusFresh(statusEntry, now, AGENT_STATUS_STALE_AFTER_MS)
    )
    facts[paneKey] = {
      worktreeId,
      status: statusIsFresh ? (statusEntry?.state ?? null) : null,
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
