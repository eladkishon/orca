import { describe, expect, it } from 'vitest'
import type { RuntimeWorktreeAgentRow } from '../../../src/shared/runtime-types'
import {
  agentActivityLabel,
  buildDashboardCards,
  groupCardsByProject,
  type BoardWorktree
} from './agent-dashboard-board'
import {
  dashboardFilterOptions,
  filterDashboardCards,
  EMPTY_DASHBOARD_FILTERS
} from './agent-board-filtering'

const NOW = 1_000_000_000

function agent(overrides: Partial<RuntimeWorktreeAgentRow>): RuntimeWorktreeAgentRow {
  return {
    paneKey: 'pane-1',
    parentPaneKey: null,
    state: 'working',
    agentType: 'claude',
    prompt: 'do the thing',
    taskTitle: null,
    displayName: null,
    lastAssistantMessage: null,
    toolName: null,
    toolInput: null,
    interrupted: false,
    stateStartedAt: NOW,
    updatedAt: NOW,
    ...overrides
  }
}

function worktree(
  id: string,
  agents: RuntimeWorktreeAgentRow[],
  repo = 'orca',
  hostId = 'host-1'
): BoardWorktree {
  return {
    worktreeId: id,
    repoId: `${repo}-id`,
    repo,
    branch: `branch-${id}`,
    displayName: `ws-${id}`,
    path: `/tmp/${id}`,
    liveTerminalCount: 1,
    hasAttachedPty: true,
    preview: '',
    unread: true,
    isPinned: false,
    linkedPR: null,
    agents,
    boardHostId: hostId,
    boardHostName: hostId === 'host-1' ? 'Laptop' : 'Server'
  }
}

describe('buildDashboardCards', () => {
  it('sorts needs-you before working, newest first within a state', () => {
    const cards = buildDashboardCards(
      [
        worktree('a', [agent({ paneKey: 'w', state: 'working' })]),
        worktree('b', [agent({ paneKey: 'b', state: 'waiting' })])
      ],
      NOW
    )
    expect(cards.map((card) => card.paneKey)).toEqual(['host-1:b', 'host-1:w'])
  })

  it('decays a stale working agent into idle', () => {
    const stale = NOW - 31 * 60 * 1000
    const [card] = buildDashboardCards(
      [worktree('a', [agent({ state: 'working', updatedAt: stale, stateStartedAt: stale })])],
      NOW
    )
    expect(card.bucket).toBe('idle')
  })

  it('settles a finished agent to idle once its workspace has been seen', () => {
    const done = agent({ state: 'done' })
    const [unseen] = buildDashboardCards([worktree('a', [done])], NOW)
    expect(unseen.dotState).toBe('done')
    const [seen] = buildDashboardCards([{ ...worktree('a', [done]), unread: false }], NOW)
    expect(seen.dotState).toBe('idle')
  })

  it('heads a card with the session name, then the workspace, and never repeats the prompt', () => {
    const [named] = buildDashboardCards(
      [worktree('a', [agent({ displayName: 'Ship the board' })])],
      NOW
    )
    expect(named.heading).toBe('Ship the board')
    expect(named.userMessage).toBe('do the thing')
    const [same] = buildDashboardCards(
      [worktree('a', [agent({ displayName: 'do the thing' })])],
      NOW
    )
    expect(same.userMessage).toBeUndefined()
  })

  it('keeps the repo colour per repo while identity stays per host', () => {
    const cards = buildDashboardCards(
      [
        worktree('a', [agent({ paneKey: 'a' })], 'orca', 'host-1'),
        worktree('b', [agent({ paneKey: 'b' })], 'orca', 'host-2')
      ],
      NOW
    )
    expect(cards[0].repoId).toBe(cards[1].repoId)
    expect(cards[0].projectKey).not.toBe(cards[1].projectKey)
  })
})

describe('groupCardsByProject', () => {
  it('gives each host its own column for the same repo', () => {
    const cards = buildDashboardCards(
      [
        worktree('a', [agent({ paneKey: 'a' })], 'orca', 'host-1'),
        worktree('b', [agent({ paneKey: 'b' })], 'orca', 'host-2'),
        worktree('c', [agent({ paneKey: 'c' })], 'other', 'host-1')
      ],
      NOW
    )
    const groups = groupCardsByProject(cards)
    expect(groups).toHaveLength(3)
    expect(groups.map((group) => group.hostId)).toContain('host-2')
  })
})

describe('filterDashboardCards', () => {
  const cards = buildDashboardCards(
    [
      {
        ...worktree('a', [agent({ paneKey: 'a', lastAssistantMessage: 'fixed the parser' })]),
        workspaceStatus: 'In review',
        linkedPR: { number: 42, state: 'open' }
      },
      worktree('b', [agent({ paneKey: 'b' })], 'other')
    ],
    NOW
  )

  it('searches the text a card actually shows', () => {
    expect(filterDashboardCards(cards, 'parser', EMPTY_DASHBOARD_FILTERS)).toHaveLength(1)
    expect(filterDashboardCards(cards, '#42', EMPTY_DASHBOARD_FILTERS)).toHaveLength(1)
    expect(filterDashboardCards(cards, '', EMPTY_DASHBOARD_FILTERS)).toHaveLength(2)
  })

  it('filters by project, workspace status and review state', () => {
    expect(
      filterDashboardCards(cards, '', { ...EMPTY_DASHBOARD_FILTERS, projects: ['host-1:other-id'] })
    ).toHaveLength(1)
    expect(
      filterDashboardCards(cards, '', {
        ...EMPTY_DASHBOARD_FILTERS,
        workspaceStatuses: ['In review']
      })
    ).toHaveLength(1)
    expect(
      filterDashboardCards(cards, '', { ...EMPTY_DASHBOARD_FILTERS, reviewStates: ['none'] })
    ).toHaveLength(1)
  })

  it('offers only the options its own cards carry', () => {
    const options = dashboardFilterOptions(cards)
    expect(options.projects.map((project) => project.label)).toEqual([
      'orca · Laptop',
      'other · Laptop'
    ])
    expect(options.workspaceStatuses).toEqual(['In review'])
    expect(options.reviewStates).toEqual(['none', 'open'])
  })
})

describe('agentActivityLabel', () => {
  it('joins tool and input, and stays absent without a tool', () => {
    expect(agentActivityLabel({ toolName: 'Bash', toolInput: 'pnpm test' })).toBe('Bash: pnpm test')
    expect(agentActivityLabel({ toolName: 'Bash', toolInput: '  ' })).toBe('Bash')
    expect(agentActivityLabel({ toolName: null, toolInput: 'x' })).toBeUndefined()
  })
})
