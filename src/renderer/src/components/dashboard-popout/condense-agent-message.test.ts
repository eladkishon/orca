import { describe, expect, it } from 'vitest'
import { condenseAgentMessage } from './condense-agent-message'

describe('condenseAgentMessage', () => {
  it('leaves a short message alone', () => {
    expect(condenseAgentMessage('Updated the parser.', 100)).toBe('Updated the parser.')
  })

  it('flattens a multi-line dump into one flow', () => {
    expect(condenseAgentMessage('Exit code 1\n\n  throw new Error\n', 100)).toBe(
      'Exit code 1 throw new Error'
    )
  })

  it('drops the line numbers a grep hit carries', () => {
    // "18: /** The accessible name" is scaffolding around one useful phrase.
    expect(condenseAgentMessage('18: The accessible name 46: Drag refs', 100)).toBe(
      'The accessible name Drag refs'
    )
  })

  it('drops comment and rule scaffolding', () => {
    expect(condenseAgentMessage('/** The accessible name */ --- ^ Error', 100)).toBe(
      'The accessible name Error'
    )
  })

  it('cuts at a word boundary and marks the elision', () => {
    const condensed = condenseAgentMessage('alpha beta gamma delta epsilon', 14)

    expect(condensed).toBe('alpha beta\u2026')
  })

  it('cuts mid-word rather than throwing most of the budget away', () => {
    // One very long token would otherwise collapse the whole message to "…".
    const condensed = condenseAgentMessage('a supercalifragilisticexpialidocious', 12)

    expect(condensed).toBe('a supercalif\u2026')
  })

  it('keeps a message that is exactly at the limit whole', () => {
    expect(condenseAgentMessage('abcde', 5)).toBe('abcde')
  })
})
