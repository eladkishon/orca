import { describe, expect, it } from 'vitest'
import { agentEfficiency, formatCostUsd, formatTokenCount } from './agent-efficiency'

function usage(overrides: Partial<Parameters<typeof agentEfficiency>[0]> = {}) {
  return {
    turns: 100,
    inputTokens: 200_000,
    outputTokens: 100_000,
    cacheReadTokens: 40_000_000,
    cacheWriteTokens: 300_000,
    ...overrides
  }
}

describe('agentEfficiency', () => {
  it('measures what the turns cost, not what the cache re-read', () => {
    // Cache reads dwarf everything and are billed at a fraction of the price.
    // Counting them made every agent look enormous and none look different.
    const result = agentEfficiency(usage())

    expect(result.billableTokens).toBe(600_000)
    expect(result.reusedTokens).toBe(40_000_000)
    expect(result.billablePerTurn).toBe(6_000)
    expect(result.grade).toBe('efficient')
  })

  it('separates a tight session from a bloated one', () => {
    // The reuse rate cannot do this: it is ~100% for every live agent. Billable
    // context per step is what actually differs.
    const tight = agentEfficiency(usage())
    const bloated = agentEfficiency(usage({ turns: 4 }))

    expect(tight.grade).toBe('efficient')
    expect(bloated.grade).toBe('costly')
    expect(bloated.billablePerTurn).toBeGreaterThan(tight.billablePerTurn ?? 0)
  })

  it('grades a genuinely cold session as costly however small its steps', () => {
    const cold = agentEfficiency(
      usage({ inputTokens: 400_000, cacheReadTokens: 100_000, turns: 400 })
    )

    expect(cold.cacheReuseRate).toBeLessThan(0.7)
    expect(cold.grade).toBe('costly')
    expect(cold.headline).toContain('re-sent')
  })

  it('flags a working cache that still pays for a lot each step', () => {
    const result = agentEfficiency(usage({ turns: 20 }))

    expect(result.grade).toBe('mixed')
    expect(result.headline).toContain('new context')
  })

  it('carries the scan’s own cost figure rather than inventing one', () => {
    expect(agentEfficiency(usage({ estimatedCostUsd: 4.2 })).estimatedCostUsd).toBe(4.2)
    expect(agentEfficiency(usage()).estimatedCostUsd).toBeNull()
  })

  it('says it does not know rather than guessing', () => {
    const empty = agentEfficiency({
      turns: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0
    })

    expect(empty.grade).toBe('unknown')
    expect(empty.billablePerTurn).toBeNull()
  })
})

describe('formatting', () => {
  it('stays readable at every magnitude', () => {
    expect(formatTokenCount(900)).toBe('900')
    expect(formatTokenCount(12_400)).toBe('12k')
    expect(formatTokenCount(1_240_000)).toBe('1.2M')
    expect(formatCostUsd(0.4)).toBe('$0.40')
    expect(formatCostUsd(42.6)).toBe('$43')
  })
})
