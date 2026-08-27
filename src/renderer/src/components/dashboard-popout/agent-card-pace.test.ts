import { describe, expect, it } from 'vitest'
import { AGENT_PACE_SLOW_MS, AGENT_PACE_STALLED_MS, dashboardCardPace } from './agent-card-pace'
import type { DashboardCard } from '../../../../shared/dashboard-snapshot'

const NOW = 1_700_000_000_000

function card(): DashboardCard {
  return {
    dotState: 'working',
    unseen: true,
    statusUpdatedAt: NOW,
    stateChangedAt: NOW
  } as unknown as DashboardCard
}

describe('dashboardCardPace', () => {
  it('reads a freshly reporting agent as advancing', () => {
    expect(dashboardCardPace(card(), NOW + 1_000)).toBe('advancing')
  })

  it('warns once an agent has gone quiet mid-turn', () => {
    expect(dashboardCardPace(card(), NOW + AGENT_PACE_SLOW_MS)).toBe('slow')
  })

  it('calls it stalled once the silence outlasts any ordinary command', () => {
    expect(dashboardCardPace(card(), NOW + AGENT_PACE_STALLED_MS)).toBe('stalled')
  })

  it('gives a finished agent no pace, since it is quiet on purpose', () => {
    // Otherwise every idle card on the board would light up as stuck.
    const done = { ...card(), dotState: 'done', unseen: false } as DashboardCard
    expect(dashboardCardPace(done, NOW + AGENT_PACE_STALLED_MS)).toBe('advancing')
  })

  it('treats monitoring as advancing — it is waiting by design', () => {
    const monitoring = { ...card(), workingMode: 'monitoring' } as DashboardCard
    expect(dashboardCardPace(monitoring, NOW + AGENT_PACE_STALLED_MS)).toBe('advancing')
  })

  it('falls back to the state timestamp when a client sends no status time', () => {
    const older = { ...card(), statusUpdatedAt: undefined } as DashboardCard
    expect(dashboardCardPace(older, NOW + 1_000)).toBe('advancing')
    expect(dashboardCardPace(older, NOW + AGENT_PACE_STALLED_MS)).toBe('stalled')
  })
})
