/**
 * Types one command into a stalled pane's live shell — the `--resume` line for a
 * pane whose agent process exited.
 *
 * Separate from active-agent-note-send because that path deliberately refuses
 * any pane the runtime does not report as a live agent session; here the absence
 * of an agent is exactly the condition being repaired. Routing still goes
 * through the worktree's owner host, so SSH and remote runtimes are covered.
 */

import { useAppStore } from '@/store'
import { callRuntimeRpc, getActiveRuntimeTarget } from '@/runtime/runtime-rpc-client'
import { getSettingsForWorktreeRuntimeOwner } from '@/lib/worktree-runtime-owner'
import { findActiveRuntimeTerminal } from '@/lib/active-agent-note-target'
import type { RuntimeTerminalSend } from '../../../shared/runtime-types'

const STALLED_AGENT_SHELL_SEND_TIMEOUT_MS = 5_000
const ORCA_DESKTOP_TERMINAL_CLIENT = { id: 'orca-desktop', type: 'desktop' as const }

export async function sendStalledAgentShellCommand({
  worktreeId,
  noteTarget,
  command
}: {
  worktreeId: string
  noteTarget: { tabId: string; leafId: string }
  command: string
}): Promise<boolean> {
  const trimmed = command.trim()
  if (!trimmed) {
    return false
  }
  const runtimeTarget = getActiveRuntimeTarget(
    getSettingsForWorktreeRuntimeOwner(useAppStore.getState(), worktreeId)
  )
  const terminal = await findActiveRuntimeTerminal(
    runtimeTarget,
    worktreeId,
    noteTarget,
    STALLED_AGENT_SHELL_SEND_TIMEOUT_MS
  )
  if (!terminal) {
    return false
  }
  const { send } = await callRuntimeRpc<{ send: RuntimeTerminalSend }>(
    runtimeTarget,
    'terminal.send',
    {
      terminal: terminal.handle,
      text: trimmed,
      enter: true,
      client: ORCA_DESKTOP_TERMINAL_CLIENT
    },
    { timeoutMs: STALLED_AGENT_SHELL_SEND_TIMEOUT_MS }
  )
  return send.accepted
}
