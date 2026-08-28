import { describe, expect, it } from 'vitest'
import { agentUsageShare, formatPercent, isResentShareWorthFixing } from './agent-efficiency'

function usage(overrides: Partial<Parameters<typeof agentUsageShare>[0]> = {}) {
  return {
    turns: 100,
    inputTokens: 200_000,
    outputTokens: 100_000,
    cacheReadTokens: 40_000_000,
    cacheWriteTokens: 300_000,
    ...overrides
  }
}

describe('agentUsageShare', () => {
  it('measures what the turns paid for, not what the cache re-read', () => {
    // Cache reads dwarf everything and are billed at a fraction, so counting
    // them made every agent look enormous and none look different.
    const share = agentUsageShare(usage(), 6_000_000)

    expect(share.billableTokens).toBe(600_000)
    expect(share.reusedTokens).toBe(40_000_000)
  })

  it('says how much of the week went here', () => {
    expect(agentUsageShare(usage(), 6_000_000).weeklyShare).toBeCloseTo(0.1)
  })

  it('names the part that caching could have avoided', () => {
    // Input is context sent again at full price; output is the agent's own
    // words and cache writes are what make re-use possible.
    expect(agentUsageShare(usage(), 6_000_000).resentShare).toBeCloseTo(1 / 3)
  })

  it('has no share to report without a week to compare against', () => {
    expect(agentUsageShare(usage(), 0).weeklyShare).toBeNull()
  })

  it('flags a re-sent share large enough to be worth fixing', () => {
    expect(isResentShareWorthFixing(agentUsageShare(usage(), 6_000_000))).toBe(true)
    expect(
      isResentShareWorthFixing(agentUsageShare(usage({ inputTokens: 1_000 }), 6_000_000))
    ).toBe(false)
  })
})

describe('formatPercent', () => {
  it('never rounds a real share down to nothing', () => {
    // A project that used something did not use nothing.
    expect(formatPercent(0.001)).toBe('<1%')
    expect(formatPercent(0)).toBe('0%')
    expect(formatPercent(0.334)).toBe('33%')
    expect(formatPercent(null)).toBe('—')
  })
})
