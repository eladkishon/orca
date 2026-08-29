import { describe, expect, it } from 'vitest'
import { buildUsageFixPrompt, diagnoseUsage } from './agent-usage-diagnosis'
import type { AgentEfficiencyInput } from './agent-efficiency'

function usage(overrides: Partial<AgentEfficiencyInput> = {}): AgentEfficiencyInput {
  return {
    turns: 100,
    inputTokens: 1_000,
    outputTokens: 10_000,
    // 50k of context per turn: modest.
    cacheReadTokens: 5_000_000,
    cacheWriteTokens: 50_000,
    costUsd: { input: 0.003, output: 0.15, cacheRead: 1.5, cacheWrite: 0.1875 },
    ...overrides
  }
}

describe('diagnoseUsage', () => {
  it('calls a modest context healthy rather than inventing an action', () => {
    expect(diagnoseUsage(usage()).id).toBe('healthy')
  })

  it('flags a context past the rate-doubling threshold above all else', () => {
    // 40M over 100 turns = 400k per turn, past 200k.
    const result = diagnoseUsage(usage({ cacheReadTokens: 40_000_000 }))

    expect(result.id).toBe('over-threshold')
    expect(result.contextPerTurn).toBe(400_000)
  })

  it('flags a heavy context before it reaches the cliff', () => {
    // 15M over 100 turns = 150k: under 200k, over the 100k watch line.
    expect(diagnoseUsage(usage({ cacheReadTokens: 15_000_000 })).id).toBe('heavy-context')
  })

  it('reports what share of cost went on carrying context', () => {
    // cacheRead + cacheWrite over the total: the number that showed input was
    // never the problem.
    expect(diagnoseUsage(usage()).contextCostShare).toBeCloseTo(1.6875 / 1.8405, 3)
  })

  it('reports no context size rather than dividing by zero on an empty row', () => {
    const result = diagnoseUsage({
      turns: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0
    })

    expect(result).toEqual({ id: 'healthy', contextPerTurn: null, contextCostShare: null })
  })
})

describe('buildUsageFixPrompt', () => {
  it('carries every figure the popover showed, so the agent can verify it', () => {
    const subject = usage({ cacheReadTokens: 40_000_000 })
    const prompt = buildUsageFixPrompt({
      diagnosis: diagnoseUsage(subject),
      usage: subject,
      scopeLabel: 'the orca repo',
      sinceDay: '2026-03-04'
    })

    expect(prompt).toContain('the orca repo')
    expect(prompt).toContain('2026-03-04')
    expect(prompt).toContain('Context carried into every turn')
    expect(prompt).toContain('Cache reads')
    // The agent must not start editing on the strength of a dashboard chip.
    expect(prompt).toContain('Do not change anything until I agree.')
  })

  it('points the agent at the things that actually fill base context', () => {
    // The usage scan reads token counts only, so naming the suspects is the
    // whole value of the prompt.
    const subject = usage({ cacheReadTokens: 40_000_000 })
    const prompt = buildUsageFixPrompt({
      diagnosis: diagnoseUsage(subject),
      usage: subject,
      scopeLabel: 'the orca repo'
    })

    expect(prompt).toContain('Skills')
    expect(prompt).toContain('MCP')
    expect(prompt).toContain('CLAUDE.md')
    expect(prompt).toContain('never actually been invoked')
  })

  it('tells a healthy repo to say so rather than manufacture work', () => {
    const subject = usage()
    const prompt = buildUsageFixPrompt({
      diagnosis: diagnoseUsage(subject),
      usage: subject,
      scopeLabel: 'the orca repo'
    })

    expect(prompt).toContain('rather than inventing work')
  })
})
