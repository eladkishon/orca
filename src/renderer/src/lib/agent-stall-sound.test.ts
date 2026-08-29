import { describe, expect, it } from 'vitest'
import { AGENT_STALL_EPISODE_RESET_MS } from '../../../shared/agent-stall-recovery-policy'
import { shouldSoundAgentStall, type AgentStallSoundLedger } from './agent-stall-sound'

const observation = {
  paneKey: 'tab-1:leaf-1',
  cause: 'auth' as const,
  signature: 'logged-out',
  observedAt: 1_000_000
}

describe('shouldSoundAgentStall', () => {
  it('sounds once per stall episode, not once per TUI repaint', () => {
    const ledger: AgentStallSoundLedger = new Map()
    expect(shouldSoundAgentStall(ledger, observation)).toBe(true)
    expect(shouldSoundAgentStall(ledger, { ...observation, observedAt: 1_000_500 })).toBe(false)
  })

  it('sounds again once the episode has reset', () => {
    const ledger: AgentStallSoundLedger = new Map()
    shouldSoundAgentStall(ledger, observation)
    expect(
      shouldSoundAgentStall(ledger, {
        ...observation,
        observedAt: observation.observedAt + AGENT_STALL_EPISODE_RESET_MS
      })
    ).toBe(true)
  })

  it('sounds for a different failure on the same pane', () => {
    const ledger: AgentStallSoundLedger = new Map()
    shouldSoundAgentStall(ledger, observation)
    expect(shouldSoundAgentStall(ledger, { ...observation, cause: 'network' })).toBe(true)
    expect(
      shouldSoundAgentStall(ledger, { ...observation, signature: 'rate-limited-until-noon' })
    ).toBe(true)
  })
})
