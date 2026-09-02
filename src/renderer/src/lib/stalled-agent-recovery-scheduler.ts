/**
 * Drives automatic recovery while any stall is outstanding.
 *
 * A store subscription is not enough: skips are time-based (settle, backoff), so
 * the plan must be re-evaluated as time passes. Hence a poll that exists only
 * while there is something to recover.
 */

import { useAppStore, type AppState } from '@/store'
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

/** Panes whose agent reported a tool call after the failure line. A stalled
 *  CLI makes none (its own request failed); one that did was reading a tool's
 *  output — a curl refused, a test log quoting ECONNREFUSED — and re-prompting
 *  it once it finishes tells a done agent its turn "stopped early". Both
 *  timestamps are stamped by local main, so they compare. */
export function paneKeysContinuedPastStall(
  state: Pick<AppState, 'agentStallByPaneKey' | 'agentStatusByPaneKey'>
): string[] {
  return Object.values(state.agentStallByPaneKey)
    .filter((observation) => {
      const entry = state.agentStatusByPaneKey[observation.paneKey]
      return (
        entry?.state === 'working' &&
        Boolean(entry.toolName) &&
        entry.updatedAt > observation.observedAt
      )
    })
    .map((observation) => observation.paneKey)
}

type SchedulerDeps = {
  recover?: typeof recoverStalledAgentPanes
  setInterval?: typeof globalThis.setInterval
  clearInterval?: typeof globalThis.clearInterval
  intervalMs?: number
}

/** Installed once at startup, unconditionally: the fact sink is what makes a
 *  stall visible at all, so turning auto-recovery off must still show it. */
export function installAutomaticAgentStallRecovery(deps: SchedulerDeps = {}): () => void {
  const recover = deps.recover ?? recoverStalledAgentPanes
  const start = deps.setInterval ?? globalThis.setInterval
  const stop = deps.clearInterval ?? globalThis.clearInterval
  const intervalMs = deps.intervalMs ?? AGENT_STALL_RECOVERY_POLL_MS
  let timer: ReturnType<typeof globalThis.setInterval> | null = null
  let running = false
  let disposed = false

  const stillEnabled = (): boolean =>
    !disposed && isAutomaticAgentStallRecoveryEnabled(useAppStore.getState().settings)

  const runOnce = (): void => {
    // Why the guard: a fleet walk waits on each pane's TUI readiness, so a tick
    // can easily outlive the interval. Overlapping walks would double-nudge.
    // (recoverStalledAgentPanes also owns a shared in-flight guard used by
    // every caller — this tick and a manual "Continue" click alike — which
    // stops THOSE two from overlapping; this local guard is still needed so a
    // scheduler under test with an injected `recover` upholds the same
    // property on its own.)
    if (running || disposed) {
      return
    }
    running = true
    // shouldContinue: settings can flip mid-walk (a sequential walk spans
    // several TUI-idle waits); re-checking before each step stops the walk on
    // the very next step instead of running the rest of the plan regardless.
    void recover({ shouldContinue: stillEnabled })
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
    // Runs even with auto-recovery off: the badge must clear as well as the nudge.
    if (
      state.agentStallByPaneKey !== previousState.agentStallByPaneKey ||
      state.agentStatusByPaneKey !== previousState.agentStatusByPaneKey
    ) {
      const continued = paneKeysContinuedPastStall(state)
      if (continued.length > 0) {
        // The clear re-enters this subscription with the smaller map, which syncs.
        state.clearAgentStallObservations(continued)
        return
      }
    }
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
