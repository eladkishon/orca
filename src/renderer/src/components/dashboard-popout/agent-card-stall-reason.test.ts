import { describe, expect, it } from 'vitest'
import { agentCardStallReason, agentStallCauseLabel } from './agent-card-stall-reason'

describe('agentStallCauseLabel', () => {
  it('names each cause the detector can report', () => {
    expect(agentStallCauseLabel('auth')).toBe('Logged out')
    expect(agentStallCauseLabel('network')).toBe('Network')
    expect(agentStallCauseLabel('rate-limit')).toBe('Rate limited')
  })
})

describe('agentCardStallReason', () => {
  it('prefers a detected cause over anything inferred', () => {
    expect(agentCardStallReason({ stallReason: 'Network', activity: 'Bash: pnpm test' })).toBe(
      'Network'
    )
  })

  it('falls back to the tool that is running', () => {
    // "Waiting on Bash" is already most of the answer for a slow command.
    expect(agentCardStallReason({ activity: 'Bash: pnpm test' })).toBe('Waiting on Bash')
  })

  it('says so plainly when there is nothing to point at', () => {
    expect(agentCardStallReason({})).toBe('No output')
    expect(agentCardStallReason({ activity: '' })).toBe('No output')
  })
})
