import type { RuntimeWorktreeAgentRow } from '../../../src/shared/runtime-types'
import { agentDotState, type AgentDotState } from '../worktree/agent-row-display'
import type { Worktree } from '../worktree/workspace-list-types'
import { agentCardDisplayState } from './agent-card-appearance'

// The board is columns of PROJECTS, as on desktop (dashboard-popout/
// AgentKanbanBoard.tsx): the card's ring says needs-you / working / stalled /
// done, so a column spent on state repeated what every card already showed.
// State survives as the sort within a project.

/** A workspace tagged with the host it came from, so one board can span hosts. */
export type BoardWorktree = Worktree & { boardHostId: string; boardHostName?: string }

export type DashboardBucket = 'attention' | 'working' | 'done' | 'idle'

const BUCKET_RANK: Record<DashboardBucket, number> = {
  attention: 0,
  working: 1,
  done: 2,
  idle: 3
}

export type DashboardAgentCard = {
  paneKey: string
  hostId: string
  /** Shown on the card only when the board covers more than one host. */
  hostName?: string
  worktreeId: string
  /** The repo's own id, which the project's colour is derived from. */
  repoId: string
  /** Host-scoped project identity: two hosts can hold the same repo id. */
  projectKey: string
  repo: string
  workspaceName: string
  /** The card's title: the agent's own session name, else the workspace. */
  heading: string
  agentType: string | null
  /** State after the done→idle settle, which is what the ring is drawn from. */
  dotState: AgentDotState
  bucket: DashboardBucket
  /** The last thing the agent said. */
  agentMessage?: string
  /** The last thing the user asked, when it isn't already the heading. */
  userMessage?: string
  /** "Bash: pnpm test" while a tool is running; absent otherwise. */
  activity?: string
  isMainWorktree: boolean
  /** The workspace's own status (Orca's kanban status), for the board filter. */
  workspaceStatus?: string
  review?: { number: number; state: string }
  linearIssue?: string
  /** Nobody has opened this workspace since it last moved. */
  unseen: boolean
  updatedAt: number
  stateStartedAt: number
}

export type DashboardProjectGroup = {
  /** Host-scoped project identity, and the React key for a column. */
  projectKey: string
  repoId: string
  hostId: string
  hostName?: string
  projectName: string
  cards: DashboardAgentCard[]
}

export function dashboardBucket(state: AgentDotState): DashboardBucket {
  switch (state) {
    case 'blocked':
    case 'waiting':
    case 'interrupted':
      return 'attention'
    case 'working':
    case 'monitoring':
      return 'working'
    case 'done':
      return 'done'
    default:
      return 'idle'
  }
}

// Desktop shows the running tool on the card; mobile has toolName/toolInput on
// the wire row, so compose the same "Tool: input" line.
export function agentActivityLabel(
  row: Pick<RuntimeWorktreeAgentRow, 'toolName' | 'toolInput'>
): string | undefined {
  const tool = row.toolName?.trim()
  if (!tool) {
    return undefined
  }
  const input = row.toolInput?.trim()
  return input ? `${tool}: ${input}` : tool
}

function buildCard(worktree: BoardWorktree, row: RuntimeWorktreeAgentRow, now: number) {
  const dotState = agentCardDisplayState(agentDotState(row, now), worktree.unread)
  const heading = row.displayName?.trim() || row.taskTitle?.trim() || worktree.displayName
  const prompt = row.prompt.trim()
  const card: DashboardAgentCard = {
    paneKey: `${worktree.boardHostId}:${row.paneKey}`,
    hostId: worktree.boardHostId,
    hostName: worktree.boardHostName,
    worktreeId: worktree.worktreeId,
    repoId: worktree.repoId,
    projectKey: `${worktree.boardHostId}:${worktree.repoId}`,
    repo: worktree.repo,
    workspaceName: worktree.displayName || worktree.branch,
    heading: heading || worktree.repo,
    agentType: row.agentType,
    dotState,
    bucket: dashboardBucket(dotState),
    agentMessage: row.lastAssistantMessage?.trim() || undefined,
    // Why: repeating the prompt under a heading taken from it says it twice.
    userMessage: prompt && prompt !== heading ? prompt : undefined,
    activity: agentActivityLabel(row),
    isMainWorktree: worktree.isMainWorktree === true,
    workspaceStatus: worktree.workspaceStatus,
    review: worktree.linkedPR ?? undefined,
    linearIssue: worktree.linkedLinearIssue ?? undefined,
    unseen: worktree.unread,
    updatedAt: row.updatedAt,
    stateStartedAt: row.stateStartedAt
  }
  return card
}

/** Needs-you first, then working, then done — and within a state, newest first. */
export function sortCardsByUrgency(cards: readonly DashboardAgentCard[]): DashboardAgentCard[] {
  return [...cards].sort((first, second) => {
    const rank = BUCKET_RANK[first.bucket] - BUCKET_RANK[second.bucket]
    return rank === 0 ? second.stateStartedAt - first.stateStartedAt : rank
  })
}

export function buildDashboardCards(
  worktrees: readonly BoardWorktree[],
  now: number
): DashboardAgentCard[] {
  const cards: DashboardAgentCard[] = []
  for (const worktree of worktrees) {
    for (const row of worktree.agents ?? []) {
      cards.push(buildCard(worktree, row, now))
    }
  }
  return sortCardsByUrgency(cards)
}

/**
 * One group per project, in the order their first (most urgent) card appears —
 * the desktop board's `groupCardsByProject`, which the columns and the rows
 * layout both read.
 */
export function groupCardsByProject(cards: readonly DashboardAgentCard[]): DashboardProjectGroup[] {
  const groups = new Map<string, DashboardProjectGroup>()
  for (const card of cards) {
    const existing = groups.get(card.projectKey)
    if (existing) {
      existing.cards.push(card)
      continue
    }
    groups.set(card.projectKey, {
      projectKey: card.projectKey,
      repoId: card.repoId,
      hostId: card.hostId,
      hostName: card.hostName,
      projectName: card.repo,
      cards: [card]
    })
  }
  return [...groups.values()]
}
