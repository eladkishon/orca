import { launchAgentInNewTab } from '@/lib/launch-agent-in-new-tab'
import { useAppStore } from '@/store'
import { getExecutionHostIdForWorktree } from '@/lib/worktree-runtime-owner'
import type { DashboardSpawnAgentArgs } from '../../../shared/dashboard-snapshot'
import type { LaunchSource } from '../../../shared/telemetry-events'
import { isTuiAgentEnabled } from '../../../shared/tui-agent-selection'

/** Starts the requested agent for a workspace through the same host-aware tab path as Quick Launch. */
export function launchAgentForWorktree({
  worktreeId,
  agent,
  prompt,
  launchSource = 'unknown'
}: DashboardSpawnAgentArgs & { launchSource?: LaunchSource }): boolean {
  const state = useAppStore.getState()
  const executionHostId = getExecutionHostIdForWorktree(state, worktreeId)
  const worktree = state.getKnownWorktreeById(worktreeId, executionHostId)
  if (!worktree || !isTuiAgentEnabled(agent, state.settings?.disabledTuiAgents)) {
    return false
  }
  state.setActiveWorktree(worktreeId, executionHostId)
  return (
    launchAgentInNewTab({
      agent,
      worktreeId,
      launchSource,
      ...(prompt ? { prompt, promptDelivery: 'draft' as const } : {})
    }) !== null
  )
}
