import { describe, expect, it } from 'vitest'
import { isMeaningfulAgentMessage } from './agent-message-meaningfulness'

describe('isMeaningfulAgentMessage', () => {
  it('rejects a bare exit code, which is the shell talking', () => {
    expect(isMeaningfulAgentMessage('Exit code 1')).toBe(false)
    expect(isMeaningfulAgentMessage('exited with 127')).toBe(false)
    expect(isMeaningfulAgentMessage('Process exited')).toBe(false)
  })

  it('rejects a one-word runner verdict', () => {
    expect(isMeaningfulAgentMessage('FAILED')).toBe(false)
    expect(isMeaningfulAgentMessage('done.')).toBe(false)
    expect(isMeaningfulAgentMessage('No output')).toBe(false)
  })

  it('rejects scraps with no words in them', () => {
    expect(isMeaningfulAgentMessage('')).toBe(false)
    expect(isMeaningfulAgentMessage('   ')).toBe(false)
    expect(isMeaningfulAgentMessage('1')).toBe(false)
    expect(isMeaningfulAgentMessage('---')).toBe(false)
  })

  it('keeps the agent actually speaking', () => {
    expect(isMeaningfulAgentMessage('Exit code 1 came from the missing import')).toBe(true)
    expect(isMeaningfulAgentMessage('Done, tests pass.')).toBe(true)
    expect(isMeaningfulAgentMessage('Fixed the parser and reran the suite.')).toBe(true)
  })
})
