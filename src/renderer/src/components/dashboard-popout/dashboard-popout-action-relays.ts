import type { DashboardCard, DashboardOpenFileArgs } from '../../../../shared/dashboard-snapshot'
import type { RepoBanner } from '../../../../shared/repo-banner'
import type { TuiAgent } from '../../../../shared/tui-agent'
import type { AgentRevealArgs } from './AgentTerminalDialog'

/**
 * Everything the pop-out board can DO, relayed to the main renderer, which owns
 * the store, the tabs and the confirms. The pop-out only ever names a target.
 */

/** Ack an agent in the pop-out window: relayed over IPC to the main renderer.
 *  ?. shields dialog-opening from dev-HMR preload skew (renderer updates hot,
 *  the preload only on app restart) — acks just no-op until restart. */
export function ackAgentViaPopoutRelay(paneKey: string): void {
  void window.api.dashboard.ackAgent?.(paneKey)
}

/** Reveal an agent from the pop-out window: raise the main window and route it
 *  to the agent's pane via IPC. Same `?.` HMR-skew guard as the ack relay —
 *  both channels ship together, so a stale preload lacks both. */
export function revealAgentViaPopoutRelay(args: AgentRevealArgs): void {
  void window.api.dashboard.revealAgent?.(args)
}

/** Follow a preview file link from the pop-out window: the main renderer owns
 *  the workspace paths and the editor. Same `?.` HMR-skew guard as above. */
export function openFileViaPopoutRelay(args: DashboardOpenFileArgs): void {
  void window.api.dashboard.openFile?.(args)
}

export function createWorktreeViaPopoutRelay(repoId: string): void {
  void window.api.dashboard.createWorkspace?.({ repoId })
}

export function setProjectBannerViaPopoutRelay(repoId: string, banner: RepoBanner | null): void {
  void window.api.dashboard.setProjectBanner?.({ repoId, banner })
}

export function spawnAgentViaPopoutRelay(
  worktreeId: string,
  agent: TuiAgent,
  prompt?: string
): void {
  void window.api.dashboard.spawnAgent?.({ worktreeId, agent, ...(prompt ? { prompt } : {}) })
}

/** End an agent's session from the pop-out: the main renderer closes the tab,
 *  with the running-process confirm it already owns. */
export function endSessionViaPopoutRelay(card: DashboardCard): void {
  void window.api.dashboard.closeSession?.({
    tabId: card.tabId,
    ...(card.leafId ? { leafId: card.leafId } : {})
  })
}

/** Remove a workspace from the pop-out: the main renderer runs the ordinary
 *  delete funnel, confirm included. Same `?.` HMR-skew guard as the relays above. */
export function removeWorkspaceViaPopoutRelay(card: DashboardCard): void {
  void window.api.dashboard.removeWorkspace?.({
    worktreeId: card.worktreeId,
    ...(card.executionHostId ? { executionHostId: card.executionHostId } : {})
  })
}
