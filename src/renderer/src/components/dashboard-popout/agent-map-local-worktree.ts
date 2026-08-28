import type * as DashboardSnapshotTypes from '../../../../shared/dashboard-snapshot'
import { placeAgentMapAgents } from './agent-map-agent-placement'
import { layoutAgentMapLineage } from './agent-map-lineage-layout'
import {
  agentMapDurationMinutes,
  agentMapNodeStatus,
  agentMapQuietCount,
  emptyAgentMapStatusCounts
} from './agent-map-node-metadata'
import { agentMapWorktreeIdentityFromParts } from './agent-map-workspace-identity'
import { agentMapWorktreeHost } from './agent-map-worktree-host'
import type { AgentMapWorktreeRing } from './agent-map-layout'

type DashboardCard = DashboardSnapshotTypes.DashboardCard
type DashboardWorkspace = DashboardSnapshotTypes.DashboardWorkspace

export type LocalWorktree = Omit<AgentMapWorktreeRing, 'x' | 'y'> & { x: number; y: number }

function worktreeRadius(agentCount: number, agentRadius: number): number {
  return Math.max(52, 24 + Math.ceil(Math.sqrt(Math.max(1, agentCount))) * (agentRadius + 8))
}

export function buildLocalWorktree(
  id: string,
  cards: DashboardCard[],
  now: number,
  agentRadius: number,
  ringContentOffset: number,
  workspace?: DashboardWorkspace
): LocalWorktree {
  const lineageLayout = layoutAgentMapLineage(cards, agentRadius)
  const contentRadius = lineageLayout?.radius ?? worktreeRadius(cards.length, agentRadius)
  const radius = contentRadius + ringContentOffset
  const statusCounts = emptyAgentMapStatusCounts()
  for (const card of cards) {
    statusCounts[agentMapNodeStatus(card)] += 1
  }
  const host = agentMapWorktreeHost(cards, workspace)
  const executionHostId = host.executionHostId
  const parentWorktreeId = workspace?.parentWorktreeId ?? cards[0]?.parentWorktreeId
  return {
    id,
    parentId: parentWorktreeId
      ? agentMapWorktreeIdentityFromParts(parentWorktreeId, executionHostId)
      : undefined,
    worktreeId: workspace?.worktreeId ?? cards[0]?.worktreeId ?? id,
    ...host,
    name: workspace?.worktreeName ?? cards[0]?.worktreeName ?? id,
    workspaceKind: workspace?.workspaceKind ?? cards[0]?.workspaceKind ?? 'worktree',
    x: 0,
    y: 0,
    radius,
    agents: (
      lineageLayout?.agents.map(({ card, x, y }) => ({
        card,
        x,
        y,
        radius: agentRadius,
        durationMinutes: agentMapDurationMinutes(card, now),
        status: agentMapNodeStatus(card)
      })) ??
      placeAgentMapAgents({
        worktreeId: id,
        cards,
        radius: contentRadius,
        agentRadius,
        now
      })
    ).map((agent) => ({ ...agent, y: agent.y + ringContentOffset })),
    statusCounts,
    quiet: agentMapQuietCount(statusCounts) === cards.length
  }
}
