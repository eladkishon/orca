/**
 * Classifies one line of agent CLI output as a login/auth or network failure
 * that leaves the agent stalled mid-task.
 *
 * Why a line classifier and not a status: agent hooks report `working` /
 * `blocked` / `waiting` / `done` and carry no failure cause, so a turn that
 * died on an expired token is indistinguishable from a turn that finished.
 * The cause only exists in the bytes the CLI printed.
 *
 * Provider-neutral by construction: every pattern here is phrasing shared by
 * the CLIs and the HTTP/DNS stacks under them, so a newly supported agent is
 * covered without a per-agent table.
 */

export type AgentStallCause = 'auth' | 'network'

export type AgentStallSignature = {
  cause: AgentStallCause
  /** The matched text, for the recovery UI. Bounded — never a whole line. */
  signature: string
}

/** Longest signature echoed back to the UI. */
export const AGENT_STALL_SIGNATURE_MAX_CHARS = 120

/**
 * Failures a restart cannot fix. Checked before everything else so a line that
 * also mentions a token or a connection can never be read as recoverable —
 * retrying these burns quota (or the user's money) and hides the real blocker.
 * Rate limits are excluded here too: Orca already models them in its own
 * rate-limit subsystem, which knows the reset time this classifier does not.
 */
const UNRECOVERABLE_PATTERNS: readonly RegExp[] = [
  /\bcredit balance is too low\b/i,
  /\binsufficient (?:credit|quota|funds)\b/i,
  /\b(?:rate[- ]limit(?:ed|s)?|usage limit reached|quota exceeded)\b/i,
  /\byour (?:plan|subscription) (?:does not|doesn't) (?:include|support)\b/i,
  /\b(?:invalid|unknown|unsupported) model\b/i,
  /\bmodel (?:not found|is not available)\b/i,
  /\bcontext (?:window )?(?:limit )?exceeded\b/i,
  /\bprompt is too long\b/i,
  /\brequest (?:too large|entity too large)\b/i,
  /\b(?:permission|access) denied\b/i,
  /\bEACCES\b/,
  /\bENOENT\b/,
  /\bcommand not found\b/i
]

/** Matches that stand on their own — the phrasing is not used for anything else. */
const UNAMBIGUOUS_PATTERNS: readonly { cause: AgentStallCause; pattern: RegExp }[] = [
  // Auth
  { cause: 'auth', pattern: /\binvalid[- ]api[- ]key\b/i },
  { cause: 'auth', pattern: /\bapi key (?:is )?(?:invalid|expired|missing|not valid)\b/i },
  { cause: 'auth', pattern: /\bauthentication_error\b/i },
  { cause: 'auth', pattern: /\binvalid_(?:token|grant|client)\b/i },
  { cause: 'auth', pattern: /\b(?:oauth |access |refresh |bearer )?token (?:has )?expired\b/i },
  { cause: 'auth', pattern: /\b(?:credentials?|session|login) (?:has |have )?expired\b/i },
  { cause: 'auth', pattern: /\byou(?:'re| are)? not logged in\b/i },
  { cause: 'auth', pattern: /\blogin (?:required|expired)\b/i },
  { cause: 'auth', pattern: /\bplease (?:run|use) [`'"]?(?:\/login|[a-z-]+ login)\b/i },
  { cause: 'auth', pattern: /\brun [`'"]?\/login\b/i },
  { cause: 'auth', pattern: /\bre-?authenticat(?:e|ion required)\b/i },
  { cause: 'auth', pattern: /\bsign in (?:again|to continue)\b/i },
  { cause: 'auth', pattern: /\b401\b[^\n]{0,40}\bunauthorized\b/i },
  { cause: 'auth', pattern: /\bunauthorized\b[^\n]{0,40}\b401\b/i },
  // Network
  { cause: 'network', pattern: /\bconnection error\b/i },
  { cause: 'network', pattern: /\bfetch failed\b/i },
  { cause: 'network', pattern: /\bsocket hang up\b/i },
  { cause: 'network', pattern: /\bconnection (?:reset by peer|refused|aborted)\b/i },
  { cause: 'network', pattern: /\b(?:network|internet) is unreachable\b/i },
  { cause: 'network', pattern: /\bupstream connect error\b/i },
  { cause: 'network', pattern: /\btls handshake (?:timeout|failure)\b/i },
  { cause: 'network', pattern: /\bgetaddrinfo\b/i },
  { cause: 'network', pattern: /\boverloaded_error\b/i },
  { cause: 'network', pattern: /\bapi error\b[^\n]{0,20}\b5\d\d\b/i },
  { cause: 'network', pattern: /\b(?:502 bad gateway|503 service unavailable|504 gateway)\b/i },
  {
    cause: 'network',
    pattern:
      /\b(?:ECONNRESET|ECONNREFUSED|ECONNABORTED|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|ENETUNREACH|ENETDOWN|EHOSTUNREACH|EPROTO|UND_ERR_(?:CONNECT_TIMEOUT|SOCKET|HEADERS_TIMEOUT))\b/
  }
]

/**
 * Wording that is ordinary prose on its own ("network", "timeout"), so it only
 * counts alongside a failure marker on the same line. Without this gate, an
 * agent narrating its plan ("I'll add a timeout to the network client") reads
 * as a stall and Orca restarts a perfectly healthy agent.
 */
const ERROR_CONTEXT_PATTERN =
  /\b(?:error|errno|failed|failure|fatal|cannot|can't|could ?n(?:o|')t|unable to|refused|unreachable|aborted|retrying|giving up)\b/i

const CONTEXTUAL_PATTERNS: readonly { cause: AgentStallCause; pattern: RegExp }[] = [
  { cause: 'auth', pattern: /\bauthenticat(?:e|ion|ing)\b/i },
  { cause: 'auth', pattern: /\bunauthenticated\b/i },
  { cause: 'auth', pattern: /\bunauthorized\b/i },
  { cause: 'auth', pattern: /\bcredentials?\b/i },
  { cause: 'network', pattern: /\bnetwork\b/i },
  { cause: 'network', pattern: /\bconnect(?:ion|ing)?\b/i },
  { cause: 'network', pattern: /\btimed? ?out\b/i },
  { cause: 'network', pattern: /\bdns\b/i },
  { cause: 'network', pattern: /\bproxy\b/i },
  { cause: 'network', pattern: /\boffline\b/i }
]

/**
 * Lines that quote rather than report: a diff hunk, a shell echo, a grep hit,
 * or an agent transcript block. These carry the same words as a real failure —
 * this is the single largest false-positive source when an agent is *fixing*
 * error handling code.
 */
const QUOTED_LINE_PATTERN =
  /^\s*(?:[+-]{1,3}[^-]|[>|]|\d+[:|]|@@ )|(?:\becho\b|\bgrep\b|\bconsole\.(?:log|warn|error)\b|\bthrow new\b|\bcatch\b|`{3})/

/**
 * One cheap test that every real match must also pass, so ordinary agent output
 * costs a single regex instead of walking all the tables below. This runs on the
 * PTY byte path of every agent pane, so it is the difference between a scan that
 * disappears into the noise and one that shows up in typing latency.
 */
const CANDIDATE_PATTERN =
  // No leading \b: this only has to be *cheap* and never miss, so `overloaded_error`
  // and other embedded forms must match too. Precision belongs to the tables above.
  /(?:err(?:or|no)|fail(?:ed|ure)?|fatal|unauthoriz|unauthenticat|authenticat|credential|token|api[- ]key|login|log in|sign in|connect|network|timeout|timed out|dns|proxy|offline|socket|fetch|refused|unreachable|expired|getaddrinfo|E[A-Z_]{4,}|UND_ERR|401|4\d\d|5\d\d)/i

function truncateSignature(text: string): string {
  const collapsed = text.replace(/\s+/g, ' ').trim()
  return collapsed.length > AGENT_STALL_SIGNATURE_MAX_CHARS
    ? `${collapsed.slice(0, AGENT_STALL_SIGNATURE_MAX_CHARS - 1)}…`
    : collapsed
}

/**
 * Classifies a single already-ANSI-stripped line. Returns null for anything
 * that is not an unambiguously recoverable auth/network failure — the default
 * is always "not a stall", because a false positive restarts a working agent.
 */
export function classifyAgentStallLine(line: string): AgentStallSignature | null {
  if (line.length < 4 || line.length > 4000) {
    return null
  }
  if (!CANDIDATE_PATTERN.test(line)) {
    return null
  }
  if (QUOTED_LINE_PATTERN.test(line)) {
    return null
  }
  for (const pattern of UNRECOVERABLE_PATTERNS) {
    if (pattern.test(line)) {
      return null
    }
  }
  for (const { cause, pattern } of UNAMBIGUOUS_PATTERNS) {
    const match = pattern.exec(line)
    if (match) {
      return { cause, signature: truncateSignature(match[0]) }
    }
  }
  if (!ERROR_CONTEXT_PATTERN.test(line)) {
    return null
  }
  for (const { cause, pattern } of CONTEXTUAL_PATTERNS) {
    if (pattern.test(line)) {
      return { cause, signature: truncateSignature(line) }
    }
  }
  return null
}
