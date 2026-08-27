/**
 * Drives automatic recovery of stalled agents while any stall is outstanding.
 *
 * A store subscription alone is not enough: the reasons a pane is skipped are
 * time-based (settle window, backoff), so the plan has to be re-evaluated as
 * time passes, not only when the store changes. Hence a poll that exists ONLY
 * while there is something to recover, and stops the moment there isn't.
 */

import { useAppStore } from '@/store'
import { recoverStalledAgentPanes } from '@/lib/recover-stalled-agent-panes'
import { registerAgentStallFactSink } from '@/components/terminal-pane/terminal-side-effect-facts-handler'

/** Coarse on purpose: the settle windows are seconds and the backoffs minutes. */
export const AGENT_STALL_RECOVERY_POLL_MS = 10_000

export function isAutomaticAgentStallRecoveryEnabled(
  settings: { autoRecoverStalledAgents?: boolean } | null | undefined
): boolean {
  // Default on: the whole point is that a fleet keeps going while nobody watches.
  return settings?.autoRecoverStalledAgents !== false
}

type SchedulerDeps = {
  recover?: typeof recoverStalledAgentPanes
  setInterval?: typeof globalThis.setInterval
  clearInterval?: typeof globalThis.clearInterval
  intervalMs?: number
}

/**
 * Installed once at app startup; returns the uninstaller.
 *
 * Installation is unconditional even when the setting is off: the `agent-stall`
 * fact sink is what makes a stall visible in the status bar at all, and turning
 * automatic recovery off must still show the user which agents are stuck.
 */
export function installAutomaticAgentStallRecovery(deps: SchedulerDeps = {}): () => void {
  const recover = deps.recover ?? recoverStalledAgentPanes
  const start = deps.setInterval ?? globalThis.setInterval
  const stop = deps.clearInterval ?? globalThis.clearInterval
  const intervalMs = deps.intervalMs ?? AGENT_STALL_RECOVERY_POLL_MS
  let timer: ReturnType<typeof globalThis.setInterval> | null = null
  let running = false
  let disposed = false

  const runOnce = (): void => {
    // Why the guard: a fleet walk waits on each pane's TUI readiness, so a tick
    // can easily outlive the interval. Overlapping walks would double-nudge.
    if (running || disposed) {
      return
    }
    running = true
    void recover()
      .catch((error) => {
        console.warn('[agent-stall] automatic recovery failed:', error)
      })
      .finally(() => {
        running = false
      })
  }

  const sync = (): void => {
    if (disposed) {
      return
    }
    const state = useAppStore.getState()
    const shouldPoll =
      isAutomaticAgentStallRecoveryEnabled(state.settings) &&
      Object.keys(state.agentStallByPaneKey).length > 0
    if (shouldPoll && timer === null) {
      timer = start(runOnce, intervalMs)
      return
    }
    if (!shouldPoll && timer !== null) {
      stop(timer)
      timer = null
    }
  }

  // Main is the authoritative scanner for local/SSH bytes, hidden panes
  // included; this is where its observations enter the store.
  registerAgentStallFactSink((observation) => {
    useAppStore.getState().observeAgentStall(observation)
  })
  const unsubscribe = useAppStore.subscribe((state, previousState) => {
    if (
      state.agentStallByPaneKey !== previousState.agentStallByPaneKey ||
      state.settings?.autoRecoverStalledAgents !== previousState.settings?.autoRecoverStalledAgents
    ) {
      sync()
    }
  })
  sync()

  return () => {
    disposed = true
    registerAgentStallFactSink(null)
    unsubscribe()
    if (timer !== null) {
      stop(timer)
      timer = null
    }
  }
}
