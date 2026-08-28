/**
 * How much of each agent a board card shows — the desktop board's density,
 * in the units React Native styles with.
 *
 * Compact is the scanning view. Detailed turns each card into a small window
 * onto its agent: the same fields, given the room to be read.
 */

export type DashboardCardDensity = 'compact' | 'detailed'

export type DashboardCardDensityStyle = {
  padding: number
  gap: number
  headingSize: number
  headingLines: number
  agentMessageSize: number
  agentMessageLines: number
  userMessageLines: number
}

const COMPACT: DashboardCardDensityStyle = {
  padding: 12,
  gap: 6,
  headingSize: 15,
  headingLines: 2,
  agentMessageSize: 12.5,
  agentMessageLines: 3,
  userMessageLines: 1
}

const DETAILED: DashboardCardDensityStyle = {
  padding: 16,
  gap: 8,
  headingSize: 16,
  headingLines: 3,
  agentMessageSize: 13,
  agentMessageLines: 8,
  userMessageLines: 3
}

export function dashboardCardDensityStyle(
  density: DashboardCardDensity
): DashboardCardDensityStyle {
  return density === 'detailed' ? DETAILED : COMPACT
}
