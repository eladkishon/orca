import { describe, expect, it } from 'vitest'
import {
  collectStalledAgentPaneFacts,
  type StalledAgentPaneFactsState
} from './stalled-agent-pane-facts'
import { AGENT_STATUS_STALE_AFTER_MS } from '../../../shared/agent-status-types'
import type { AgentStatusEntry } from '../../../shared/agent-status-types'

const NOW = 1_700_000_000_000
const LEAF_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_LEAF_ID = '22222222-2222-4222-8222-222222222222'
const PANE_KEY = `tab-1:${LEAF_ID}`

function statusEntry(overrides: Partial<AgentStatusEntry> = {}): AgentStatusEntry {
  return {
    state: 'done',
    prompt: 'ship it',
    updatedAt: NOW - 1_000,
    stateStartedAt: NOW - 5_000,
    agentType: 'claude',
    paneKey: PANE_KEY,
    stateHistory: [],
    ...overrides
  } as AgentStatusEntry
}

function state(overrides: Partial<StalledAgentPaneFactsState> = {}): StalledAgentPaneFactsState {
  return {
    tabsByWorktree: { 'wt-1': [{ id: 'tab-1', launchAgent: 'claude' }] },
    terminalLayoutsByTabId: { 'tab-1': { ptyIdsByLeafId: { [LEAF_ID]: 'pty-1' } } },
    agentStatusByPaneKey: { [PANE_KEY]: statusEntry() },
    paneForegroundAgentByPaneKey: {},
    ...overrides
  }
}

describe('collectStalledAgentPaneFacts', () => {
  it('resolves the worktree, agent, and addressability of a bound agent pane', () => {
    const facts = collectStalledAgentPaneFacts(state(), [PANE_KEY], NOW)

    expect(facts[PANE_KEY]).toEqual({
      worktreeId: 'wt-1',
      agent: 'claude',
      status: 'done',
      lastOutputAt: NOW - 1_000,
      agentProcessLive: true,
      addressable: true
    })
  })

  it('reports a pane whose foreground is back at the shell as needing a relaunch', () => {
    const facts = collectStalledAgentPaneFacts(
      state({
        paneForegroundAgentByPaneKey: { [PANE_KEY]: { agent: null, shellForeground: true } }
      }),
      [PANE_KEY],
      NOW
    )

    expect(facts[PANE_KEY]?.agentProcessLive).toBe(false)
    // The tab still names the agent, so the resume path knows what to relaunch.
    expect(facts[PANE_KEY]?.agent).toBe('claude')
  })

  it('is not addressable when the leaf has no bound PTY', () => {
    const facts = collectStalledAgentPaneFacts(
      state({
        terminalLayoutsByTabId: { 'tab-1': { ptyIdsByLeafId: { [OTHER_LEAF_ID]: 'pty-9' } } }
      }),
      [PANE_KEY],
      NOW
    )

    expect(facts[PANE_KEY]?.addressable).toBe(false)
  })

  it('drops a stale hook status instead of passing it off as current', () => {
    const facts = collectStalledAgentPaneFacts(
      state({
        agentStatusByPaneKey: {
          [PANE_KEY]: statusEntry({
            state: 'working',
            updatedAt: NOW - AGENT_STATUS_STALE_AFTER_MS - 1
          })
        }
      }),
      [PANE_KEY],
      NOW
    )

    expect(facts[PANE_KEY]?.status).toBeNull()
    expect(facts[PANE_KEY]?.lastOutputAt).toBe(NOW - AGENT_STATUS_STALE_AFTER_MS - 1)
  })

  it('omits panes whose tab is gone and unparseable keys', () => {
    const facts = collectStalledAgentPaneFacts(
      state(),
      [`tab-gone:${LEAF_ID}`, 'not-a-pane-key'],
      NOW
    )

    expect(facts).toEqual({})
  })
})
