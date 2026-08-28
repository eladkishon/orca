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
 * Silence is named explicitly rather than inferred from a missing code. The
 * remote transport stamps its OWN failures — a timeout is `runtime_timeout` —
 * so "no code" would have classified exactly the case this exists for as an
 * answer. An unrecognised code is treated as an answer, which is the safe way
 * round: a host that says something new is respected rather than overridden.
 */

/** Codes the transport raises for itself when the host said nothing at all. */
const UNANSWERED_CODES = new Set(['runtime_timeout', 'remote_runtime_unavailable'])

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
      return UNANSWERED_CODES.has(code)
    }
    current = candidate.cause
  }
  // A bare Error with no code at all is a transport failure too: the socket
  // waiters reject with a plain timeout message before any frame arrives.
  return true
}
