import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentStallObservation } from '../../../shared/agent-stall-recovery-policy'

const LEAF_A = '11111111-1111-4111-8111-111111111111'
const LEAF_B = '22222222-2222-4222-8222-222222222222'
const PANE_A = `tab-a:${LEAF_A}`
const PANE_B = `tab-b:${LEAF_B}`
const NOW = 1_700_000_000_000

type RecoveryTestState = {
  agentStallByPaneKey: Record<string, AgentStallObservation>
  agentStallRecoveryLedgerByPaneKey: Record<
    string,
    { cause: 'auth' | 'network'; attempts: number; lastAttemptAt: number }
  >
  tabsByWorktree: Record<string, { id: string; launchAgent?: string | null }[]>
  terminalLayoutsByTabId: Record<string, { ptyIdsByLeafId?: Record<string, string | undefined> }>
  agentStatusByPaneKey: Record<string, never>
  paneForegroundAgentByPaneKey: Record<string, { agent: string | null; shellForeground: boolean }>
  recordAgentStallRecoveryAttempt: (paneKey: string, attempt: unknown) => void
  clearAgentStallObservations: (paneKeys: readonly string[]) => void
}

const testState = vi.hoisted(() => ({
  appState: null as unknown as RecoveryTestState,
  attempts: [] as { paneKey: string; attempt: unknown }[],
  cleared: [] as string[],
  sendNotes: vi.fn(),
  buildResumeCommand: vi.fn(),
  sendShellCommand: vi.fn()
}))

vi.mock('@/store', () => ({
  useAppStore: Object.assign(
    (selector: (state: RecoveryTestState) => unknown) => selector(testState.appState),
    { getState: () => testState.appState }
  )
}))

vi.mock('@/lib/active-agent-note-send', () => ({
  sendNotesToActiveAgentSession: testState.sendNotes
}))

vi.mock('@/lib/stalled-agent-resume-command', () => ({
  buildStalledAgentResumeCommand: testState.buildResumeCommand
}))

vi.mock('@/lib/stalled-agent-shell-command-send', () => ({
  sendStalledAgentShellCommand: testState.sendShellCommand
}))

const { buildStalledAgentContinuePrompt, recoverStalledAgentPanes } =
  await import('./recover-stalled-agent-panes')

function observation(paneKey: string, overrides: Partial<AgentStallObservation> = {}) {
  return {
    paneKey,
    cause: 'network' as const,
    signature: 'Connection error',
    observedAt: NOW - 120_000,
    ...overrides
  }
}

function createState(): RecoveryTestState {
  return {
    agentStallByPaneKey: {},
    agentStallRecoveryLedgerByPaneKey: {},
    tabsByWorktree: {
      'wt-1': [{ id: 'tab-a', launchAgent: 'claude' }],
      'wt-2': [{ id: 'tab-b', launchAgent: 'codex' }]
    },
    terminalLayoutsByTabId: {
      'tab-a': { ptyIdsByLeafId: { [LEAF_A]: 'pty-a' } },
      'tab-b': { ptyIdsByLeafId: { [LEAF_B]: 'pty-b' } }
    },
    agentStatusByPaneKey: {},
    paneForegroundAgentByPaneKey: {},
    recordAgentStallRecoveryAttempt: (paneKey, attempt) => {
      testState.attempts.push({ paneKey, attempt })
    },
    clearAgentStallObservations: (paneKeys) => {
      testState.cleared.push(...paneKeys)
      for (const paneKey of paneKeys) {
        delete testState.appState.agentStallByPaneKey[paneKey]
      }
    }
  }
}

describe('recoverStalledAgentPanes', () => {
  beforeEach(() => {
    testState.appState = createState()
    testState.attempts = []
    testState.cleared = []
    testState.sendNotes.mockReset()
    testState.buildResumeCommand.mockReset()
    testState.sendShellCommand.mockReset()
    testState.sendNotes.mockResolvedValue({ status: 'sent' })
  })

  it('continues every stalled pane in the fleet and clears the ones it recovered', async () => {
    testState.appState.agentStallByPaneKey = {
      [PANE_A]: observation(PANE_A, { observedAt: NOW - 200_000 }),
      [PANE_B]: observation(PANE_B, { cause: 'auth', signature: 'Invalid API key' })
    }

    const outcomes = await recoverStalledAgentPanes({ now: NOW })

    expect(outcomes.map((outcome) => [outcome.paneKey, outcome.status])).toEqual([
      [PANE_A, 'continued'],
      [PANE_B, 'continued']
    ])
    expect(testState.cleared).toEqual([PANE_A, PANE_B])
    expect(testState.sendNotes.mock.calls.map(([args]) => args.worktreeId)).toEqual([
      'wt-1',
      'wt-2'
    ])
    expect(testState.sendNotes.mock.calls[1][0].prompt).toBe(
      buildStalledAgentContinuePrompt('auth')
    )
  })

  it('scopes recovery to one workspace when asked', async () => {
    testState.appState.agentStallByPaneKey = {
      [PANE_A]: observation(PANE_A),
      [PANE_B]: observation(PANE_B)
    }

    const outcomes = await recoverStalledAgentPanes({ now: NOW, worktreeId: 'wt-2' })

    expect(outcomes.map((outcome) => outcome.paneKey)).toEqual([PANE_B])
  })

  it('records the attempt before sending, so a throwing send still costs the budget', async () => {
    testState.appState.agentStallByPaneKey = { [PANE_A]: observation(PANE_A) }
    testState.sendNotes.mockRejectedValue(new Error('runtime is gone'))

    const outcomes = await recoverStalledAgentPanes({ now: NOW })

    expect(testState.attempts).toEqual([
      {
        paneKey: PANE_A,
        attempt: { cause: 'network', observedAt: NOW - 120_000, attemptedAt: NOW }
      }
    ])
    expect(outcomes[0].status).toBe('failed')
    expect(testState.cleared).toEqual([])
  })

  it('falls back to a resume relaunch when the runtime reports no agent', async () => {
    testState.appState.agentStallByPaneKey = { [PANE_A]: observation(PANE_A) }
    testState.sendNotes.mockResolvedValue({ status: 'no-agent' })
    testState.buildResumeCommand.mockReturnValue({
      agent: 'claude',
      command: 'claude --resume abc',
      providerSession: { key: 'session_id', id: 'abc' }
    })
    testState.sendShellCommand.mockResolvedValue(true)

    const outcomes = await recoverStalledAgentPanes({ now: NOW })

    expect(testState.sendShellCommand).toHaveBeenCalledWith({
      worktreeId: 'wt-1',
      noteTarget: { tabId: 'tab-a', leafId: LEAF_A },
      command: 'claude --resume abc'
    })
    expect(outcomes[0]).toMatchObject({ action: 'relaunch', status: 'relaunched' })
    expect(testState.cleared).toEqual([PANE_A])
  })

  it('relaunches directly when the pane is already back at its shell', async () => {
    testState.appState.agentStallByPaneKey = { [PANE_A]: observation(PANE_A) }
    testState.appState.paneForegroundAgentByPaneKey = {
      [PANE_A]: { agent: null, shellForeground: true }
    }
    testState.buildResumeCommand.mockReturnValue({
      agent: 'claude',
      command: 'claude --resume abc',
      providerSession: { key: 'session_id', id: 'abc' }
    })
    testState.sendShellCommand.mockResolvedValue(true)

    const outcomes = await recoverStalledAgentPanes({ now: NOW })

    expect(testState.sendNotes).not.toHaveBeenCalled()
    expect(outcomes[0].status).toBe('relaunched')
  })

  it('reports a pane with nothing to resume instead of restarting it from scratch', async () => {
    testState.appState.agentStallByPaneKey = { [PANE_A]: observation(PANE_A) }
    testState.appState.paneForegroundAgentByPaneKey = {
      [PANE_A]: { agent: null, shellForeground: true }
    }
    testState.buildResumeCommand.mockReturnValue(null)

    const outcomes = await recoverStalledAgentPanes({ now: NOW })

    expect(outcomes[0].status).toBe('not-resumable')
    expect(testState.sendShellCommand).not.toHaveBeenCalled()
    expect(testState.cleared).toEqual([])
  })

  it('honours the backoff fence unless the user forces recovery', async () => {
    testState.appState.agentStallByPaneKey = { [PANE_A]: observation(PANE_A) }
    testState.appState.agentStallRecoveryLedgerByPaneKey = {
      [PANE_A]: { cause: 'network', attempts: 3, lastAttemptAt: NOW - 1_000 }
    }

    expect(await recoverStalledAgentPanes({ now: NOW })).toEqual([])
    expect(testState.sendNotes).not.toHaveBeenCalled()

    const forced = await recoverStalledAgentPanes({ now: NOW, force: true })

    expect(forced.map((outcome) => outcome.status)).toEqual(['continued'])
  })

  it('forgets an observation whose pane no longer exists', async () => {
    const ghost = `tab-gone:${LEAF_A}`
    testState.appState.agentStallByPaneKey = {
      [ghost]: observation(ghost),
      [PANE_A]: observation(PANE_A)
    }

    const outcomes = await recoverStalledAgentPanes({ now: NOW })

    expect(testState.cleared).toEqual([ghost, PANE_A])
    expect(outcomes.map((outcome) => outcome.paneKey)).toEqual([PANE_A])
  })

  it('does nothing when no pane is stalled', async () => {
    expect(await recoverStalledAgentPanes({ now: NOW })).toEqual([])
    expect(testState.sendNotes).not.toHaveBeenCalled()
  })
})
