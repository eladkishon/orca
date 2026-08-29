import { describe, expect, it } from 'vitest'
import { agentUsageShare, formatPercent } from './agent-efficiency'

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
  const priced = usage({
    costUsd: { input: 0.6, output: 1.5, cacheRead: 12, cacheWrite: 1.125 }
  })

  it('counts every token the turns touched, cache reads included', () => {
    // The earlier version excluded cache reads as "not what the turns paid
    // for". They are ~78% of a real bill.
    expect(agentUsageShare(priced, { costUsd: 100, tokens: 0 }).totalTokens).toBe(40_600_000)
  })

  it('measures the share on dollars, not tokens', () => {
    // 15.225 of 100 dollars. The token share of the same row is ~40x larger,
    // which is why the two must not be confused.
    const share = agentUsageShare(priced, { costUsd: 100, tokens: 406_000_000 })

    expect(share.spendShare).toBeCloseTo(0.15225)
    expect(share.spendShare).not.toBeCloseTo(0.1)
  })

  it('falls back to tokens only when the host priced nothing', () => {
    const share = agentUsageShare(usage(), { costUsd: null, tokens: 406_000_000 })

    expect(share.spendShare).toBeCloseTo(0.1)
  })

  it('reports the context carried into every turn', () => {
    // 40M cache reads over 100 turns: 400k of context every single turn, which
    // is over the threshold where the rate doubles.
    const share = agentUsageShare(priced, { costUsd: 100, tokens: 0 })

    expect(share.contextPerTurn).toBe(400_000)
    expect(share.overLongContextThreshold).toBe(true)
  })

  it('does not claim a context size for a row with no turns', () => {
    const share = agentUsageShare(usage({ turns: 0 }), { costUsd: 100, tokens: 0 })

    expect(share.contextPerTurn).toBeNull()
    expect(share.overLongContextThreshold).toBe(false)
  })

  it('has no share to report without a total to compare against', () => {
    expect(agentUsageShare(usage(), { costUsd: null, tokens: 0 }).spendShare).toBeNull()
  })
})

describe('formatPercent', () => {
  it('never rounds a real share down to nothing', () => {
    // A project that used something did not use nothing.
    expect(formatPercent(0)).toBe('0%')
    expect(formatPercent(0.0000001)).toBe('<0.01%')
    expect(formatPercent(null)).toBe('—')
  })

  it('keeps small shares apart instead of collapsing them into one bucket', () => {
    // The bug: measured against all usage, one long-running repo takes most of
    // the total, so a project and its own worktree both printed '<1%' and two
    // figures five times apart looked equal.
    expect(formatPercent(0.0025)).toBe('0.25%')
    expect(formatPercent(0.0005)).toBe('0.05%')
    expect(formatPercent(0.0025)).not.toBe(formatPercent(0.0005))
  })

  it('drops precision as the number grows, where it stops earning its place', () => {
    expect(formatPercent(0.065)).toBe('6.5%')
    expect(formatPercent(0.334)).toBe('33%')
  })
})
