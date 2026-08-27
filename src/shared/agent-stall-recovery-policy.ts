/**
 * Decides which stalled agent panes to recover, how, and when.
 *
 * Pure and host-agnostic on purpose: the same plan is correct for a local pane,
 * an SSH worktree, and a remote runtime, so the decision can be unit-tested
 * without a PTY. Callers own execution (see recover-stalled-agent-panes.ts).
 *
 * The hard constraint is that recovery must never become a restart loop. A
 * login that is genuinely broken keeps printing the same failure, so every
 * attempt is fenced by a per-cause settle window, exponential backoff, and an
 * attempt cap.
 */

import type { AgentStallCause } from './agent-stall-signature'
import type { AgentStatusState } from './agent-status-types'

export type AgentStallObservation = {
  paneKey: string
  cause: AgentStallCause
  signature: string
  observedAt: number
}

/** What recovery has already been tried for a pane, per cause. */
export type AgentStallRecoveryLedgerEntry = {
  cause: AgentStallCause
  attempts: number
  lastAttemptAt: number
}

export type AgentStallRecoveryPaneFacts = {
  worktreeId: string
  /** Freshest explicit hook status, or null when Orca holds none. */
  status: AgentStatusState | null
  /** The pane resolves to a tab + leaf Orca can address on its owner host. */
  addressable: boolean
}

export type AgentStallRecoveryStep = {
  paneKey: string
  worktreeId: string
  cause: AgentStallCause
  /** 1-based number of the attempt this step records. */
  attempt: number
}

export type AgentStallRecoverySkipReason =
  | 'unknown-pane'
  | 'not-addressable'
  | 'expired'
  | 'agent-working'
  | 'settling'
  | 'backoff'
  | 'attempts-exhausted'

export type AgentStallRecoverySkip = {
  paneKey: string
  reason: AgentStallRecoverySkipReason
}

export type AgentStallRecoveryPlan = {
  steps: AgentStallRecoveryStep[]
  skipped: AgentStallRecoverySkip[]
}

type CausePolicy = {
  /** Grace period before the first attempt. */
  settleMs: number
  retryBaseMs: number
  retryMaxMs: number
  maxAttempts: number
}

/**
 * Why the causes differ: the CLIs retry transient HTTP/DNS failures internally
 * for several seconds, so nudging early would collide with their own retry and
 * double-submit the turn. An expired token produces no internal retry at all,
 * but it also cannot clear until a human re-logs in — so auth gets in fast and
 * then waits much longer between attempts.
 */
const CAUSE_POLICIES: Record<AgentStallCause, CausePolicy> = {
  auth: { settleMs: 5_000, retryBaseMs: 120_000, retryMaxMs: 900_000, maxAttempts: 6 },
  network: { settleMs: 15_000, retryBaseMs: 30_000, retryMaxMs: 480_000, maxAttempts: 5 }
}

/** Beyond this an observation describes a stall nobody is waiting on any more. */
export const AGENT_STALL_OBSERVATION_TTL_MS = 12 * 60 * 60 * 1000

/**
 * A failure seen this long after the last recovery attempt is a NEW episode,
 * not a continuation, so it gets a fresh attempt budget.
 *
 * Why it must exist: without it, a pane that exhausts its budget once is never
 * recovered again for the renderer's whole lifetime — including after the user
 * fixes the login. With it, an exhausted pane degrades to a slow poll, which is
 * what "keep them all going" actually needs. The window is far wider than the
 * longest backoff, so it can never truncate an episode still being retried.
 */
export const AGENT_STALL_EPISODE_RESET_MS = 30 * 60 * 1000

/**
 * How long after a recovery attempt a new observation for the same pane is
 * treated as an echo of Orca's own paste rather than a fresh failure.
 *
 * Why it must exist: recovery types a prompt into the pane, and the pane echoes
 * what is typed into it as ordinary PTY output. Any wording overlap with the
 * classifier turns that echo into a self-feeding stall — observed live, where a
 * recovery prompt that named the failure cause was re-detected as an auth stall
 * and overwrote the real signature. The prompt is now deliberately inert
 * (buildStalledAgentContinuePrompt), and this window is the second fence, since
 * a resumed agent can also quote the failure back in its own prose.
 *
 * Sized well under the CLIs' own retry ladders, so a genuine re-failure — which
 * cannot land before the ladder gives up — is never swallowed.
 */
export const AGENT_STALL_ECHO_SUPPRESSION_MS = 8_000

/** True when `observedAt` is close enough to a recovery attempt on the same pane
 *  to be Orca's own paste (or the agent quoting it) rather than a new failure. */
export function isLikelyRecoveryEchoObservation(
  ledger: AgentStallRecoveryLedgerEntry | undefined,
  observedAt: number
): boolean {
  if (!ledger) {
    return false
  }
  const sinceAttempt = observedAt - ledger.lastAttemptAt
  return sinceAttempt >= 0 && sinceAttempt < AGENT_STALL_ECHO_SUPPRESSION_MS
}

/**
 * True while `observedAt` belongs to the episode the ledger describes. Within an
 * episode the same observation drives every attempt, so `observedAt` sits BEFORE
 * `lastAttemptAt` and the difference is negative.
 */
function isSameAgentStallEpisode(
  ledger: AgentStallRecoveryLedgerEntry | undefined,
  cause: AgentStallCause,
  observedAt: number
): boolean {
  if (!ledger || ledger.cause !== cause) {
    return false
  }
  return observedAt - ledger.lastAttemptAt <= AGENT_STALL_EPISODE_RESET_MS
}

/** Attempts already spent on this episode; 0 starts a fresh budget. */
function countAgentStallAttemptsInEpisode(
  ledger: AgentStallRecoveryLedgerEntry | undefined,
  observation: Pick<AgentStallObservation, 'cause' | 'observedAt'>
): number {
  return isSameAgentStallEpisode(ledger, observation.cause, observation.observedAt)
    ? (ledger?.attempts ?? 0)
    : 0
}

/** The ledger entry to store once an attempt is made. */
export function nextAgentStallLedgerEntry(
  ledger: AgentStallRecoveryLedgerEntry | undefined,
  attempt: { cause: AgentStallCause; observedAt: number; attemptedAt: number }
): AgentStallRecoveryLedgerEntry {
  return {
    cause: attempt.cause,
    attempts: countAgentStallAttemptsInEpisode(ledger, attempt) + 1,
    lastAttemptAt: attempt.attemptedAt
  }
}

export function getAgentStallCausePolicy(cause: AgentStallCause): CausePolicy {
  return CAUSE_POLICIES[cause]
}

/** Delay owed before attempt number `attempts + 1`. */
export function getAgentStallRetryDelayMs(cause: AgentStallCause, attempts: number): number {
  const policy = CAUSE_POLICIES[cause]
  if (attempts <= 0) {
    return 0
  }
  const backoff = policy.retryBaseMs * 2 ** (attempts - 1)
  return Math.min(policy.retryMaxMs, backoff)
}

function resolveSkipReason(
  observation: AgentStallObservation,
  facts: AgentStallRecoveryPaneFacts | undefined,
  ledger: AgentStallRecoveryLedgerEntry | undefined,
  now: number,
  force: boolean
): AgentStallRecoverySkipReason | null {
  if (!facts) {
    return 'unknown-pane'
  }
  if (now - observation.observedAt > AGENT_STALL_OBSERVATION_TTL_MS) {
    return 'expired'
  }
  if (!facts.addressable) {
    return 'not-addressable'
  }
  // Why any `working` at all, with no output-recency test: the CLIs retry a
  // failed request internally (Claude walks a 10-attempt ladder), and during
  // that retry no hook fires, so output recency cannot distinguish "still
  // retrying" from "stalled". Nudging a retrying agent queues a duplicate
  // prompt behind the one it is already working on. A retry ladder is bounded,
  // so the turn ends and the next pass sees a settled pane; waiting costs one
  // poll interval, double-prompting costs the user a corrupted turn.
  if (facts.status === 'working') {
    return 'agent-working'
  }
  // Why force stops here: the fences below are all "wait longer", and a user who
  // clicked Resume has said the waiting is over. The checks above are different —
  // they describe panes recovery cannot act on at all.
  if (force) {
    return null
  }
  const policy = CAUSE_POLICIES[observation.cause]
  if (now - observation.observedAt < policy.settleMs) {
    return 'settling'
  }
  const attempts = countAgentStallAttemptsInEpisode(ledger, observation)
  if (attempts >= policy.maxAttempts) {
    return 'attempts-exhausted'
  }
  if (attempts > 0 && ledger) {
    const owed = getAgentStallRetryDelayMs(observation.cause, attempts)
    if (now - ledger.lastAttemptAt < owed) {
      return 'backoff'
    }
  }
  return null
}

/**
 * Builds the recovery plan for every stalled pane at once — the fleet case is
 * the point: one expired token or one dropped Wi-Fi stalls every agent in the
 * workspace, and the user wants all of them continued, not one.
 */
export function planAgentStallRecovery({
  observations,
  paneFacts,
  ledger,
  now,
  force = false
}: {
  observations: readonly AgentStallObservation[]
  paneFacts: Readonly<Record<string, AgentStallRecoveryPaneFacts | undefined>>
  ledger: Readonly<Record<string, AgentStallRecoveryLedgerEntry | undefined>>
  now: number
  /** An explicit user request: skip the settle, backoff, and attempt-cap fences. */
  force?: boolean
}): AgentStallRecoveryPlan {
  const steps: AgentStallRecoveryStep[] = []
  const skipped: AgentStallRecoverySkip[] = []
  // Deterministic order so a fleet recovery replays identically in tests and
  // recovers the longest-stalled pane first.
  const ordered = [...observations].sort(
    (a, b) => a.observedAt - b.observedAt || a.paneKey.localeCompare(b.paneKey)
  )

  for (const observation of ordered) {
    const facts = paneFacts[observation.paneKey]
    const reason = resolveSkipReason(observation, facts, ledger[observation.paneKey], now, force)
    if (reason || !facts) {
      skipped.push({ paneKey: observation.paneKey, reason: reason ?? 'unknown-pane' })
      continue
    }
    steps.push({
      paneKey: observation.paneKey,
      worktreeId: facts.worktreeId,
      cause: observation.cause,
      attempt: countAgentStallAttemptsInEpisode(ledger[observation.paneKey], observation) + 1
    })
  }

  return { steps, skipped }
}
