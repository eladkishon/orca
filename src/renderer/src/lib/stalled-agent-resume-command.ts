/**
 * Builds the `--resume` line to type into a stalled pane whose agent process is
 * gone, so the same conversation continues in the shell that is still there.
 *
 * Deliberately the same construction the sleeping-agent resume and the pane
 * cold restore use (buildAgentResumeStartupPlan + resolveAgentResumeLaunchTarget):
 * resume quoting is host- and shell-sensitive, and a second implementation of it
 * would drift on Windows and WSL.
 */

import { useAppStore, type AppState } from '@/store'
import { buildAgentResumeStartupPlan } from '@/lib/tui-agent-startup'
import { resolveAgentResumeLaunchTarget } from '@/lib/agent-resume-launch-target'
import { getExecutionHostIdForWorktree } from '@/lib/worktree-runtime-owner'
import { getLocalProjectExecutionRuntimeContext } from '@/lib/local-preflight-context'
import {
  resolveTuiAgentLaunchArgs,
  resolveTuiAgentLaunchEnv
} from '../../../shared/tui-agent-launch-defaults'
import {
  isResumableTuiAgent,
  normalizeAgentProviderSession,
  type AgentProviderSessionMetadata,
  type ResumableTuiAgent,
  type SleepingAgentLaunchConfig
} from '../../../shared/agent-session-resume'
import { parsePaneKey } from '../../../shared/stable-pane-id'

type ResumeSource = {
  agent: ResumableTuiAgent
  providerSession: AgentProviderSessionMetadata
  launchConfig: SleepingAgentLaunchConfig | undefined
}

/** Live hook row first: it names the session the stalled turn belongs to. */
function resolveResumeSource(state: AppState, paneKey: string): ResumeSource | null {
  const entry = state.agentStatusByPaneKey[paneKey]
  const liveAgent = entry?.agentType
  if (entry && liveAgent && isResumableTuiAgent(liveAgent)) {
    const providerSession = normalizeAgentProviderSession(entry.providerSession)
    if (providerSession) {
      return {
        agent: liveAgent,
        providerSession,
        launchConfig: state.getAgentLaunchConfigForStatusEntry(entry)
      }
    }
  }
  const record = state.sleepingAgentSessionsByPaneKey[paneKey]
  const providerSession = normalizeAgentProviderSession(record?.providerSession)
  if (!record || !providerSession) {
    return null
  }
  return { agent: record.agent, providerSession, launchConfig: record.launchConfig }
}

export type StalledAgentResumeCommand = {
  agent: ResumableTuiAgent
  command: string
  providerSession: AgentProviderSessionMetadata
}

/**
 * Returns null whenever the pane cannot be resumed by command — no provider
 * session, an agent without a resume selector, or a launch the plan builder
 * rejects. Callers must treat null as "leave this pane to the user".
 */
export function buildStalledAgentResumeCommand(
  paneKey: string,
  worktreeId: string
): StalledAgentResumeCommand | null {
  const state = useAppStore.getState()
  const source = resolveResumeSource(state, paneKey)
  if (!source) {
    return null
  }
  const { agent, providerSession, launchConfig } = source
  const worktree = state.getKnownWorktreeById(worktreeId)
  const repo = worktree ? state.repos.find((entry) => entry.id === worktree.repoId) : null
  const tabId = parsePaneKey(paneKey)?.tabId
  const tab = tabId
    ? (state.tabsByWorktree[worktreeId] ?? []).find((candidate) => candidate.id === tabId)
    : undefined
  const resumeTarget = resolveAgentResumeLaunchTarget({
    projectRuntime: getLocalProjectExecutionRuntimeContext(state, worktreeId),
    connectionId: repo?.connectionId,
    executionHostId: getExecutionHostIdForWorktree(state, worktreeId),
    worktreePath: worktree?.path,
    terminalWindowsShell: state.settings?.terminalWindowsShell,
    // Why: the line is typed into THIS pane's live shell, so a per-tab Windows
    // shell override beats the global setting.
    ...(tab?.shellOverride ? { tabShellOverride: tab.shellOverride } : {})
  })
  const startupPlan = buildAgentResumeStartupPlan({
    agent,
    providerSession,
    cmdOverrides: state.settings?.agentCmdOverrides ?? {},
    agentArgs:
      launchConfig !== undefined
        ? launchConfig.agentArgs
        : resolveTuiAgentLaunchArgs(agent, state.settings?.agentDefaultArgs),
    agentEnv:
      launchConfig !== undefined
        ? launchConfig.agentEnv
        : resolveTuiAgentLaunchEnv(agent, state.settings?.agentDefaultEnv),
    ...(launchConfig?.agentCommand ? { agentCommand: launchConfig.agentCommand } : {}),
    ...(launchConfig?.ompResumeFilePath
      ? { ompResumeFilePath: launchConfig.ompResumeFilePath }
      : {}),
    platform: resumeTarget.platform,
    shell: resumeTarget.shell
  })
  if (!startupPlan) {
    return null
  }
  return { agent, command: startupPlan.launchCommand, providerSession }
}
