import { describe, expect, it } from 'vitest'
import { agentEfficiency, formatTokenCount } from './agent-efficiency'

function usage(overrides: Partial<Parameters<typeof agentEfficiency>[0]> = {}) {
  return {
    turns: 10,
    inputTokens: 10_000,
    outputTokens: 5_000,
    cacheReadTokens: 90_000,
    cacheWriteTokens: 10_000,
    ...overrides
  }
}

describe('agentEfficiency', () => {
  it('calls a session efficient when cache carries the context and steps stay small', () => {
    const result = agentEfficiency(usage())

    expect(result.grade).toBe('efficient')
    expect(result.cacheReuseRate).toBeCloseTo(0.9)
    expect(result.tokensPerTurn).toBe(11_500)
  })

  it('flags context that is re-sent rather than reused', () => {
    // Cache read is what re-uses context already paid for; input is what gets
    // sent again from scratch.
    const result = agentEfficiency(usage({ inputTokens: 90_000, cacheReadTokens: 10_000 }))

    expect(result.grade).toBe('mixed')
    expect(result.headline).toContain('re-sent')
  })

  it('flags a large context even when the cache is working', () => {
    // Warm cache (90% reused) but one enormous step.
    const result = agentEfficiency(usage({ turns: 1, cacheReadTokens: 900_000 }))

    expect(result.cacheReuseRate).toBeGreaterThan(0.5)
    expect(result.grade).toBe('mixed')
    expect(result.headline).toContain('large context')
  })

  it('reserves the worst grade for both problems at once', () => {
    const result = agentEfficiency(
      usage({ turns: 1, inputTokens: 900_000, cacheReadTokens: 10_000 })
    )

    expect(result.grade).toBe('costly')
  })

  it('says it does not know rather than guessing', () => {
    // A confident number nobody can trace is worse than an honest gap.
    const empty = agentEfficiency({
      turns: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0
    })

    expect(empty.grade).toBe('unknown')
    expect(empty.cacheReuseRate).toBeNull()
    expect(empty.tokensPerTurn).toBeNull()
  })

  it('excludes the agent’s own output from the reuse rate', () => {
    // Output is what the agent wrote; it is neither reused nor re-sent context.
    const withOutput = agentEfficiency(usage({ outputTokens: 500_000 }))

    expect(withOutput.cacheReuseRate).toBeCloseTo(0.9)
  })
})

describe('formatTokenCount', () => {
  it('stays readable at every magnitude', () => {
    expect(formatTokenCount(900)).toBe('900')
    expect(formatTokenCount(12_400)).toBe('12k')
    expect(formatTokenCount(1_240_000)).toBe('1.2M')
    expect(formatTokenCount(24_000_000)).toBe('24M')
  })
})
