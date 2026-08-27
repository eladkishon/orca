/**
 * Blocks a column's cards by project, so a bucket full of agents reads as
 * "what each project is doing" rather than one undifferentiated list.
 *
 * `repoId`/`repoName` already carry the project identity the filters use — the
 * snapshot builder fills them from `workspace.projectId`/`projectName`, which
 * resolves a folder workspace to its project group too.
 */

import type { DashboardCard } from '../../../../shared/dashboard-snapshot'

export type DashboardColumnGroup = {
  projectId: string
  projectName: string
  cards: DashboardCard[]
}

/**
 * Groups stay in the order their first card appears, and cards keep the order
 * they arrived in — the column is already sorted by state recency, and
 * regrouping must not quietly reorder within a project.
 */
export function groupCardsByProject(cards: readonly DashboardCard[]): DashboardColumnGroup[] {
  const groups = new Map<string, DashboardColumnGroup>()
  for (const card of cards) {
    const projectId = card.repoId
    const existing = groups.get(projectId)
    if (existing) {
      existing.cards.push(card)
      continue
    }
    groups.set(projectId, { projectId, projectName: card.repoName, cards: [card] })
  }
  return [...groups.values()]
}
