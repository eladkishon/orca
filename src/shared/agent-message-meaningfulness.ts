/**
 * Whether an agent's "last message" is actually the agent saying something.
 *
 * The field carries whatever the hook last captured, and a lot of that is the
 * shell talking rather than the agent: a bare exit code, a status word, a
 * fragment of tool output. On a card those read as the agent's current
 * thought — the screenshot that prompted this showed "Claude Exit code 1" as
 * the only thing a working agent appeared to be saying, nineteen minutes after
 * the command in question had failed.
 *
 * This does not fix staleness, which needs the message to be timestamped at
 * the hook. It removes the content that was never worth a line in the first
 * place.
 */

/**
 * Shell and runner echoes that carry no agent voice at all.
 *
 * Every pattern matches the WHOLE message. Matching a prefix would throw away
 * "Exit code 1 came from the missing import", which is the agent explaining
 * itself and the most useful line on the card.
 */
const TOOL_ECHO_PATTERNS: readonly RegExp[] = [
  /^exit(?:ed)? (?:code|status|with)\s*[:=]?\s*\d+\.?$/i,
  /^(?:command )?(?:failed|succeeded|done|ok|passed|error)\.?$/i,
  /^\(?no (?:output|changes|files?)(?: found| to show)?\)?\.?$/i,
  /^process exited(?: with[^.]*)?\.?$/i,
  /^\$?\s*\d+\s*$/
]

/** Below this a "message" is a fragment, not a sentence. */
const MIN_MEANINGFUL_CHARS = 12

export function isMeaningfulAgentMessage(message: string | undefined): boolean {
  const trimmed = message?.trim()
  if (!trimmed || !/[\p{L}]/u.test(trimmed)) {
    return false
  }
  if (TOOL_ECHO_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return false
  }
  // Why: a short line that is still a sentence stays — "Done, tests pass." is
  // worth showing. The length floor only catches wordless scraps.
  return trimmed.length >= MIN_MEANINGFUL_CHARS || /\s/.test(trimmed)
}
