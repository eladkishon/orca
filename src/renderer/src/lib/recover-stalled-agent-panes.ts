/**
 * Continues every agent stalled by a login or network failure.
 *
 * The fleet is the unit of work: one expired token or one dropped uplink stalls
 * every agent in the workspace at the same moment, so recovery walks all of
 * them from a single plan instead of asking the user to reopen panes one by one.
 *
 * Execution reuses the existing agent send path (active-agent-note-send), which
 * already resolves the worktree's owner host, waits for the TUI to be idle, and
 * refuses to type into a pane that is not a live agent — so this module never
 * needs its own local/SSH/remote branching.
 */

import { useAppStore } from '@/store'
import {
  planAgentStallRecovery,
  type AgentStallRecoveryAction,
  type AgentStallRecoveryStep
} from '../../../shared/agent-stall-recovery-policy'
import type { AgentStallCause } from '../../../shared/agent-stall-signature'
import { isTerminalLeafId, parsePaneKey } from '../../../shared/stable-pane-id'
import { collectStalledAgentPaneFacts } from '@/lib/stalled-agent-pane-facts'
import { buildStalledAgentResumeCommand } from '@/lib/stalled-agent-resume-command'
import {
  sendNotesToActiveAgentSession,
  type ActiveAgentNotesSendStatus
} from '@/lib/active-agent-note-send'
import { sendStalledAgentShellCommand } from '@/lib/stalled-agent-shell-command-send'

/**
 * Why the prompt says what it says: the stalled turn may have half-applied its
 * work, and the agent cannot see that Orca restarted it. Asking it to re-verify
 * is what stops a resumed turn from duplicating edits.
 *
 * Why it names no failure: the pane echoes whatever Orca types into it, and that
 * echo is PTY output like any other. Wording this prompt the obvious way ("your
 * turn was cut short by an authentication failure") made the classifier read
 * Orca's own paste back as a fresh stall — a self-feeding loop that also
 * overwrote the real signature shown to the user. The prompt must therefore
 * carry none of the vocabulary in agent-stall-signature.ts, which is why it says
 * "stopped early" instead of naming the cause. assertContinuePromptIsInert
 * below is the ratchet that keeps it that way.
 */
export function buildStalledAgentContinuePrompt(cause: AgentStallCause): string {
  const hint =
    cause === 'auth'
      ? 'Your sign-in was refreshed in the meantime.'
      : 'The link to your provider is available again.'
  return [
    'Your previous turn stopped early through no fault of your own.',
    hint,
    'Re-check which steps actually completed, then continue the task from there.',
    'Do not repeat work that already landed.'
  ].join(' ')
}

export type AgentStallRecoveryOutcomeStatus =
  | 'continued'
  | 'relaunched'
  | 'not-resumable'
  | 'unavailable'
  | 'failed'

export type AgentStallRecoveryOutcome = {
  paneKey: string
  worktreeId: string
  cause: AgentStallCause
  action: AgentStallRecoveryAction
  status: AgentStallRecoveryOutcomeStatus
  /** The underlying send status, when one was produced. */
  sendStatus?: ActiveAgentNotesSendStatus
}

function toOutcomeStatus(sendStatus: ActiveAgentNotesSendStatus): AgentStallRecoveryOutcomeStatus {
  if (sendStatus === 'sent') {
    return 'continued'
  }
  // Why 'unavailable' and not 'failed': the pane went away or is not an agent
  // session any more, which is a state change, not a recovery error.
  return sendStatus === 'no-active-terminal' ? 'unavailable' : 'failed'
}

async function nudgeStalledAgent(
  step: AgentStallRecoveryStep,
  noteTarget: { tabId: string; leafId: string }
): Promise<{ status: AgentStallRecoveryOutcomeStatus; sendStatus: ActiveAgentNotesSendStatus }> {
  const result = await sendNotesToActiveAgentSession({
    worktreeId: step.worktreeId,
    prompt: buildStalledAgentContinuePrompt(step.cause),
    noteTarget
  })
  return { status: toOutcomeStatus(result.status), sendStatus: result.status }
}

async function relaunchStalledAgent(
  step: AgentStallRecoveryStep,
  noteTarget: { tabId: string; leafId: string }
): Promise<{ status: AgentStallRecoveryOutcomeStatus }> {
  const resume = buildStalledAgentResumeCommand(step.paneKey, step.worktreeId)
  if (!resume) {
    return { status: 'not-resumable' }
  }
  const accepted = await sendStalledAgentShellCommand({
    worktreeId: step.worktreeId,
    noteTarget,
    command: resume.command
  })
  return { status: accepted ? 'relaunched' : 'failed' }
}

async function runRecoveryStep(step: AgentStallRecoveryStep): Promise<AgentStallRecoveryOutcome> {
  const parsed = parsePaneKey(step.paneKey)
  if (!parsed || !isTerminalLeafId(parsed.leafId)) {
    return { ...step, status: 'unavailable' }
  }
  const noteTarget = { tabId: parsed.tabId, leafId: parsed.leafId }
  if (step.action === 'nudge') {
    const nudged = await nudgeStalledAgent(step, noteTarget)
    // Why the fallthrough: the pane's foreground evidence can be one command
    // boundary behind, so the runtime is the authority on "there is no agent".
    if (nudged.sendStatus !== 'no-agent') {
      return { ...step, status: nudged.status, sendStatus: nudged.sendStatus }
    }
    const relaunched = await relaunchStalledAgent(step, noteTarget)
    return { ...step, action: 'relaunch', status: relaunched.status, sendStatus: 'no-agent' }
  }
  const relaunched = await relaunchStalledAgent(step, noteTarget)
  return { ...step, status: relaunched.status }
}

export type RecoverStalledAgentPanesOptions = {
  now?: number
  /** Restrict recovery to one workspace; omitted means the whole fleet. */
  worktreeId?: string
  /** An explicit user request: recover now, past the settle and backoff fences. */
  force?: boolean
}

/**
 * Runs the plan and reports what happened per pane. Steps run one at a time on
 * purpose: each one waits for its agent TUI to be idle, and a parallel burst
 * across a whole fleet would put every pane's readiness probe on the same host
 * at once.
 */
export async function recoverStalledAgentPanes(
  options: RecoverStalledAgentPanesOptions = {}
): Promise<AgentStallRecoveryOutcome[]> {
  const now = options.now ?? Date.now()
  const state = useAppStore.getState()
  const observations = Object.values(state.agentStallByPaneKey)
  if (observations.length === 0) {
    return []
  }
  const paneFacts = collectStalledAgentPaneFacts(
    state,
    observations.map((observation) => observation.paneKey),
    now
  )
  const scoped = options.worktreeId
    ? observations.filter(
        (observation) => paneFacts[observation.paneKey]?.worktreeId === options.worktreeId
      )
    : observations
  const plan = planAgentStallRecovery({
    observations: scoped,
    paneFacts,
    ledger: state.agentStallRecoveryLedgerByPaneKey,
    now,
    ...(options.force ? { force: true } : {})
  })

  // Why here: an observation whose pane no longer exists (or aged out) would
  // otherwise keep the pane counted as stalled until the cap or TTL evicted it.
  const forgettable = plan.skipped
    .filter((skip) => skip.reason === 'unknown-pane' || skip.reason === 'expired')
    .map((skip) => skip.paneKey)
  if (forgettable.length > 0) {
    useAppStore.getState().clearAgentStallObservations(forgettable)
  }

  const outcomes: AgentStallRecoveryOutcome[] = []
  for (const step of plan.steps) {
    const observation = state.agentStallByPaneKey[step.paneKey]
    // Why record before acting: a send that throws or a renderer reload mid-walk
    // must still cost an attempt, or the backoff fence cannot hold.
    useAppStore.getState().recordAgentStallRecoveryAttempt(step.paneKey, {
      cause: step.cause,
      observedAt: observation?.observedAt ?? now,
      attemptedAt: now
    })
    let outcome: AgentStallRecoveryOutcome
    try {
      outcome = await runRecoveryStep(step)
    } catch (error) {
      console.warn(`[agent-stall] recovery failed for ${step.paneKey}:`, error)
      outcome = { ...step, status: 'failed' }
    }
    outcomes.push(outcome)
    if (outcome.status === 'continued' || outcome.status === 'relaunched') {
      // The ledger is kept deliberately: an agent that re-stalls immediately
      // must keep spending its attempt budget instead of looping.
      useAppStore.getState().clearAgentStallObservations([step.paneKey])
    }
  }
  return outcomes
}
