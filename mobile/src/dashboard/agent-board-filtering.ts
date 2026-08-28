import type { DashboardAgentCard } from './agent-dashboard-board'

// Port of the desktop board's filters (dashboard-popout/agent-board-filtering.ts),
// over the fields a mobile card actually carries.

export type DashboardReviewFilter = 'open' | 'closed' | 'merged' | 'draft' | 'none'

export type DashboardFilters = {
  projects: string[]
  workspaceStatuses: string[]
  reviewStates: DashboardReviewFilter[]
}

export const EMPTY_DASHBOARD_FILTERS: DashboardFilters = {
  projects: [],
  workspaceStatuses: [],
  reviewStates: []
}

export function activeDashboardFilterCount(filters: DashboardFilters): number {
  return filters.projects.length + filters.workspaceStatuses.length + filters.reviewStates.length
}

export function toggleDashboardFilter<T extends string>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((current) => current !== value) : [...values, value]
}

function cardSearchText(card: DashboardAgentCard): string {
  return [
    card.heading,
    card.workspaceName,
    card.repo,
    card.agentType,
    card.userMessage,
    card.agentMessage,
    card.activity,
    card.linearIssue,
    card.review ? `#${card.review.number}` : ''
  ]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase()
}

export function filterDashboardCards(
  cards: readonly DashboardAgentCard[],
  query: string,
  filters: DashboardFilters
): DashboardAgentCard[] {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  return cards.filter((card) => {
    const reviewState = (card.review?.state.toLowerCase() ?? 'none') as DashboardReviewFilter
    return (
      (normalizedQuery.length === 0 || cardSearchText(card).includes(normalizedQuery)) &&
      (filters.projects.length === 0 || filters.projects.includes(card.projectKey)) &&
      (filters.workspaceStatuses.length === 0 ||
        (card.workspaceStatus !== undefined &&
          filters.workspaceStatuses.includes(card.workspaceStatus))) &&
      (filters.reviewStates.length === 0 || filters.reviewStates.includes(reviewState))
    )
  })
}

/** The filter options a board can actually offer, drawn from its own cards. */
export function dashboardFilterOptions(cards: readonly DashboardAgentCard[]): {
  projects: { id: string; label: string }[]
  workspaceStatuses: string[]
  reviewStates: DashboardReviewFilter[]
} {
  const projects = new Map<string, string>()
  const workspaceStatuses = new Set<string>()
  const reviewStates = new Set<DashboardReviewFilter>()
  for (const card of cards) {
    projects.set(card.projectKey, card.hostName ? `${card.repo} · ${card.hostName}` : card.repo)
    if (card.workspaceStatus) {
      workspaceStatuses.add(card.workspaceStatus)
    }
    reviewStates.add((card.review?.state.toLowerCase() ?? 'none') as DashboardReviewFilter)
  }
  return {
    projects: [...projects]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    workspaceStatuses: [...workspaceStatuses].sort(),
    reviewStates: [...reviewStates].sort()
  }
}
