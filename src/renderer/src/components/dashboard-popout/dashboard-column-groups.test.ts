import { describe, expect, it } from 'vitest'
import { groupCardsByProject } from './dashboard-column-groups'
import type { DashboardCard } from '../../../../shared/dashboard-snapshot'

function card(paneKey: string, repoId: string, repoName: string): DashboardCard {
  return { paneKey, repoId, repoName } as unknown as DashboardCard
}

describe('groupCardsByProject', () => {
  it('blocks cards under the project they belong to', () => {
    const groups = groupCardsByProject([
      card('a', 'repo-1', 'nomadpoint'),
      card('b', 'repo-2', 'shopify-agentIQ'),
      card('c', 'repo-1', 'nomadpoint')
    ])

    expect(groups).toEqual([
      {
        projectId: 'repo-1',
        projectName: 'nomadpoint',
        cards: [card('a', 'repo-1', 'nomadpoint'), card('c', 'repo-1', 'nomadpoint')]
      },
      {
        projectId: 'repo-2',
        projectName: 'shopify-agentIQ',
        cards: [card('b', 'repo-2', 'shopify-agentIQ')]
      }
    ])
  })

  it('keeps groups in the order their first card appears', () => {
    // The column is already sorted by state recency; grouping must not reorder
    // it into alphabetical or id order behind the user's back.
    const groups = groupCardsByProject([
      card('a', 'zeta', 'Zeta'),
      card('b', 'alpha', 'Alpha'),
      card('c', 'zeta', 'Zeta')
    ])

    expect(groups.map((group) => group.projectId)).toEqual(['zeta', 'alpha'])
  })

  it('keeps cards in their original order inside a group', () => {
    const groups = groupCardsByProject([
      card('first', 'repo-1', 'p'),
      card('second', 'repo-2', 'q'),
      card('third', 'repo-1', 'p')
    ])

    expect(groups[0].cards.map((entry) => entry.paneKey)).toEqual(['first', 'third'])
  })

  it('returns nothing for an empty column', () => {
    expect(groupCardsByProject([])).toEqual([])
  })
})
