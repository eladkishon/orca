/**
 * Whether a runtime RPC failed because nobody answered.
 *
 * The distinction matters for anything that treats a remote call as optional.
 * A host that ANSWERS with an error has made a decision — "I cannot tell which
 * row you mean", "you may not do that" — and a caller must respect it. A host
 * that never answered has decided nothing; it is asleep, off, or unreachable,
 * and a caller that treats silence as refusal leaves the user stuck on state
 * only that machine can release.
 *
 * Answered failures carry a machine token. Transport failures — timeouts,
 * refused connections, a dead tunnel — carry only a message, so the ABSENCE of
 * a code is the signal, which also means a new error class the host invents
 * later is treated as an answer rather than as silence.
 */

export function isUnansweredRuntimeRpcFailure(error: unknown): boolean {
  const seen = new Set<unknown>()
  let current = error
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current)
    const candidate = current as {
      cause?: unknown
      code?: unknown
      error?: { code?: unknown }
      response?: { error?: { code?: unknown } }
    }
    const code = candidate.code ?? candidate.error?.code ?? candidate.response?.error?.code
    if (typeof code === 'string' && code.length > 0) {
      return false
    }
    current = candidate.cause
  }
  return true
}
