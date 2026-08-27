import { describe, expect, it } from 'vitest'
import {
  AGENT_STALL_EPISODE_RESET_MS,
  AGENT_STALL_OBSERVATION_TTL_MS,
  getAgentStallCausePolicy,
  nextAgentStallLedgerEntry,
  getAgentStallRetryDelayMs,
  isAgentStallRecoveryPending,
  planAgentStallRecovery,
  type AgentStallObservation,
  type AgentStallRecoveryLedgerEntry,
  type AgentStallRecoveryPaneFacts
} from './agent-stall-recovery-policy'

const NOW = 1_700_000_000_000

function observation(overrides: Partial<AgentStallObservation> = {}): AgentStallObservation {
  return {
    paneKey: 'tab-a:leaf-a',
    cause: 'network',
    signature: 'Connection error',
    observedAt: NOW - 60_000,
    ...overrides
  }
}

function facts(overrides: Partial<AgentStallRecoveryPaneFacts> = {}): AgentStallRecoveryPaneFacts {
  return {
    worktreeId: 'wt-1',
    agent: 'claude',
    status: 'done',
    lastOutputAt: NOW - 120_000,
    agentProcessLive: true,
    addressable: true,
    ...overrides
  }
}

function plan({
  observations,
  paneFacts,
  ledger = {},
  now = NOW,
  force
}: {
  observations: readonly AgentStallObservation[]
  paneFacts: Record<string, AgentStallRecoveryPaneFacts | undefined>
  ledger?: Record<string, AgentStallRecoveryLedgerEntry | undefined>
  now?: number
  force?: boolean
}): ReturnType<typeof planAgentStallRecovery> {
  return planAgentStallRecovery({ observations, paneFacts, ledger, now, force })
}

describe('planAgentStallRecovery', () => {
  it('recovers every stalled pane in one plan, longest-stalled first', () => {
    const result = plan({
      observations: [
        observation({ paneKey: 'tab-b:leaf-b', observedAt: NOW - 30_000 }),
        observation({ paneKey: 'tab-a:leaf-a', observedAt: NOW - 90_000 }),
        observation({ paneKey: 'tab-c:leaf-c', observedAt: NOW - 60_000, cause: 'auth' })
      ],
      paneFacts: {
        'tab-a:leaf-a': facts(),
        'tab-b:leaf-b': facts({ worktreeId: 'wt-2' }),
        'tab-c:leaf-c': facts({ worktreeId: 'wt-3', agent: 'codex' })
      }
    })

    expect(result.skipped).toEqual([])
    expect(result.steps.map((step) => step.paneKey)).toEqual([
      'tab-a:leaf-a',
      'tab-c:leaf-c',
      'tab-b:leaf-b'
    ])
    expect(result.steps.every((step) => step.attempt === 1)).toBe(true)
  })

  it('nudges a live agent and relaunches one whose process is gone', () => {
    const result = plan({
      observations: [
        observation({ paneKey: 'live:leaf-a' }),
        observation({ paneKey: 'dead:leaf-a' })
      ],
      paneFacts: {
        'live:leaf-a': facts({ agentProcessLive: true }),
        'dead:leaf-a': facts({ agentProcessLive: false })
      }
    })

    expect(result.steps.find((step) => step.paneKey === 'live:leaf-a')?.action).toBe('nudge')
    expect(result.steps.find((step) => step.paneKey === 'dead:leaf-a')?.action).toBe('relaunch')
  })

  it('lets the CLI finish its own retry before the first network attempt', () => {
    const settleMs = getAgentStallCausePolicy('network').settleMs

    const result = plan({
      observations: [observation({ observedAt: NOW - settleMs + 1 })],
      paneFacts: { 'tab-a:leaf-a': facts() }
    })

    expect(result.steps).toEqual([])
    expect(result.skipped).toEqual([{ paneKey: 'tab-a:leaf-a', reason: 'settling' }])
    expect(isAgentStallRecoveryPending('settling')).toBe(true)
  })

  it('backs off exponentially between attempts and then gives up', () => {
    const ledgerAt = (attempts: number, lastAttemptAt: number): AgentStallRecoveryLedgerEntry => ({
      cause: 'network',
      attempts,
      lastAttemptAt
    })
    const secondAttemptDelay = getAgentStallRetryDelayMs('network', 1)
    const thirdAttemptDelay = getAgentStallRetryDelayMs('network', 2)

    expect(thirdAttemptDelay).toBe(secondAttemptDelay * 2)

    const tooSoon = plan({
      observations: [observation()],
      paneFacts: { 'tab-a:leaf-a': facts() },
      ledger: { 'tab-a:leaf-a': ledgerAt(1, NOW - secondAttemptDelay + 1) }
    })
    expect(tooSoon.skipped).toEqual([{ paneKey: 'tab-a:leaf-a', reason: 'backoff' }])

    const due = plan({
      observations: [observation()],
      paneFacts: { 'tab-a:leaf-a': facts() },
      ledger: { 'tab-a:leaf-a': ledgerAt(1, NOW - secondAttemptDelay) }
    })
    expect(due.steps[0]?.attempt).toBe(2)

    const exhausted = plan({
      observations: [observation()],
      paneFacts: { 'tab-a:leaf-a': facts() },
      ledger: {
        'tab-a:leaf-a': ledgerAt(getAgentStallCausePolicy('network').maxAttempts, NOW - 1_000)
      }
    })
    expect(exhausted.skipped).toEqual([{ paneKey: 'tab-a:leaf-a', reason: 'attempts-exhausted' }])
  })

  it('gives an exhausted pane a fresh budget once a new stall episode starts', () => {
    const spent: AgentStallRecoveryLedgerEntry = {
      cause: 'network',
      attempts: getAgentStallCausePolicy('network').maxAttempts,
      lastAttemptAt: NOW - AGENT_STALL_EPISODE_RESET_MS - 120_000
    }

    const sameEpisode = plan({
      observations: [observation({ observedAt: spent.lastAttemptAt - 1_000 })],
      paneFacts: { 'tab-a:leaf-a': facts() },
      ledger: { 'tab-a:leaf-a': spent }
    })
    expect(sameEpisode.skipped).toEqual([{ paneKey: 'tab-a:leaf-a', reason: 'attempts-exhausted' }])

    const newEpisode = plan({
      observations: [observation({ observedAt: NOW - 60_000 })],
      paneFacts: { 'tab-a:leaf-a': facts() },
      ledger: { 'tab-a:leaf-a': spent }
    })
    expect(newEpisode.steps[0]?.attempt).toBe(1)
  })

  it('counts attempts within one episode as the ledger is written', () => {
    const first = nextAgentStallLedgerEntry(undefined, {
      cause: 'network',
      observedAt: NOW - 60_000,
      attemptedAt: NOW
    })
    expect(first).toEqual({ cause: 'network', attempts: 1, lastAttemptAt: NOW })

    const second = nextAgentStallLedgerEntry(first, {
      cause: 'network',
      observedAt: NOW - 60_000,
      attemptedAt: NOW + 30_000
    })
    expect(second.attempts).toBe(2)

    const laterEpisode = nextAgentStallLedgerEntry(second, {
      cause: 'network',
      observedAt: NOW + 30_000 + AGENT_STALL_EPISODE_RESET_MS + 1,
      attemptedAt: NOW + 30_000 + AGENT_STALL_EPISODE_RESET_MS + 2
    })
    expect(laterEpisode.attempts).toBe(1)
  })

  it('force overrides the waiting fences but never the unrecoverable ones', () => {
    const forced = plan({
      observations: [
        observation({ paneKey: 'waiting:leaf-a', observedAt: NOW - 1_000 }),
        observation({ paneKey: 'aider:leaf-a' })
      ],
      paneFacts: {
        'waiting:leaf-a': facts(),
        'aider:leaf-a': facts({ agent: 'aider' })
      },
      ledger: {
        'waiting:leaf-a': {
          cause: 'network',
          attempts: getAgentStallCausePolicy('network').maxAttempts,
          lastAttemptAt: NOW - 100
        }
      },
      force: true
    })

    expect(forced.steps.map((step) => step.paneKey)).toEqual(['waiting:leaf-a'])
    expect(forced.skipped).toEqual([{ paneKey: 'aider:leaf-a', reason: 'not-resumable-agent' }])
  })

  it('caps the backoff so a long-broken login keeps being retried', () => {
    const policy = getAgentStallCausePolicy('auth')

    expect(getAgentStallRetryDelayMs('auth', 20)).toBe(policy.retryMaxMs)
    expect(getAgentStallRetryDelayMs('auth', 0)).toBe(0)
  })

  it('starts a fresh budget when the failure changes cause', () => {
    const result = plan({
      observations: [observation({ cause: 'auth', observedAt: NOW - 10_000 })],
      paneFacts: { 'tab-a:leaf-a': facts() },
      ledger: { 'tab-a:leaf-a': { cause: 'network', attempts: 5, lastAttemptAt: NOW - 1_000 } }
    })

    expect(result.steps).toEqual([
      {
        paneKey: 'tab-a:leaf-a',
        worktreeId: 'wt-1',
        cause: 'auth',
        action: 'nudge',
        attempt: 1
      }
    ])
  })

  it('leaves an agent that resumed on its own alone', () => {
    const result = plan({
      observations: [observation()],
      paneFacts: { 'tab-a:leaf-a': facts({ status: 'working', lastOutputAt: NOW - 1_000 }) }
    })

    expect(result.skipped).toEqual([{ paneKey: 'tab-a:leaf-a', reason: 'recovered' }])
    expect(isAgentStallRecoveryPending('recovered')).toBe(false)
  })

  it('does not treat stale working evidence as recovery', () => {
    const result = plan({
      observations: [observation({ observedAt: NOW - 60_000 })],
      paneFacts: { 'tab-a:leaf-a': facts({ status: 'working', lastOutputAt: NOW - 90_000 }) }
    })

    expect(result.steps).toHaveLength(1)
  })

  it('skips panes it cannot resume or address', () => {
    const result = plan({
      observations: [
        observation({ paneKey: 'no-agent:leaf-a' }),
        observation({ paneKey: 'aider:leaf-a' }),
        observation({ paneKey: 'unmounted:leaf-a' }),
        observation({ paneKey: 'ghost:leaf-a' }),
        observation({
          paneKey: 'ancient:leaf-a',
          observedAt: NOW - AGENT_STALL_OBSERVATION_TTL_MS - 1
        })
      ],
      paneFacts: {
        'no-agent:leaf-a': facts({ agent: null }),
        'aider:leaf-a': facts({ agent: 'aider' }),
        'unmounted:leaf-a': facts({ addressable: false }),
        'ancient:leaf-a': facts()
      }
    })

    expect(result.steps).toEqual([])
    expect(new Map(result.skipped.map((skip) => [skip.paneKey, skip.reason]))).toEqual(
      new Map([
        ['no-agent:leaf-a', 'not-resumable-agent'],
        ['aider:leaf-a', 'not-resumable-agent'],
        ['unmounted:leaf-a', 'not-addressable'],
        ['ghost:leaf-a', 'unknown-pane'],
        ['ancient:leaf-a', 'expired']
      ])
    )
  })
})
