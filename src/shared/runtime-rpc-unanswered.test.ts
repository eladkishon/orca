import { describe, expect, it } from 'vitest'
import { isUnansweredRuntimeRpcFailure } from './runtime-rpc-unanswered'

describe('isUnansweredRuntimeRpcFailure', () => {
  it('treats a timeout or a refused connection as unanswered', () => {
    expect(isUnansweredRuntimeRpcFailure(new Error('Runtime call timed out after 15000ms'))).toBe(
      true
    )
    expect(isUnansweredRuntimeRpcFailure(new Error('connect ECONNREFUSED'))).toBe(true)
  })

  it('treats a coded failure as an answer, however it is wrapped', () => {
    // The host decided something; a caller must respect that decision.
    expect(isUnansweredRuntimeRpcFailure({ code: 'selector_ambiguous' })).toBe(false)
    expect(isUnansweredRuntimeRpcFailure({ error: { code: 'repo_not_found' } })).toBe(false)
    expect(isUnansweredRuntimeRpcFailure({ response: { error: { code: 'denied' } } })).toBe(false)
    expect(isUnansweredRuntimeRpcFailure(new Error('wrapped', { cause: { code: 'denied' } }))).toBe(
      false
    )
  })

  it('does not spin on a cycle', () => {
    const looped: { cause?: unknown } = {}
    looped.cause = looped

    expect(isUnansweredRuntimeRpcFailure(looped)).toBe(true)
  })

  it('treats an empty code as no answer at all', () => {
    expect(isUnansweredRuntimeRpcFailure({ code: '' })).toBe(true)
  })
})
