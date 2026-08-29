/**
 * The concrete things an agent is working *on* outside its own terminal — the
 * page it just loaded, the simulator it just booted.
 *
 * A card says what an agent is running; a touchpoint is the surface that
 * command produced, so the board can hand you that surface directly instead of
 * making you reconstruct it from a shell line.
 */

export type AgentTouchpointKind = 'browser' | 'simulator'

export type AgentTouchpoint = {
  kind: AgentTouchpointKind
  /** Short chip text: `localhost:3000`, `Simulator`. */
  label: string
  /** The exact URL the agent touched. Only ever set for `browser`. */
  url?: string
}

/** Board cards stay scannable; the trail already holds the full history. */
export const AGENT_TOUCHPOINTS_MAX = 4

/** Wire guard bound: a chip label is short, a URL is the long case. */
const TOUCHPOINT_MAX_TEXT_LENGTH = 2_048

const URL_PATTERN = /https?:\/\/[^\s'"`)\]<>]+/gi
const SIMULATOR_PATTERN = /\b(xcrun\s+simctl|simctl|Simulator\.app|iOS Simulator)\b/i

/** Trailing sentence punctuation is prose, not part of the address. */
function trimUrl(raw: string): string {
  return raw.replace(/[.,;:!?]+$/, '')
}

/** `http://localhost:3000/users/1` → `localhost:3000/users`. */
function browserLabel(url: URL): string {
  const segment = url.pathname.split('/').find((part) => part.length > 0)
  const label = segment ? `${url.host}/${segment}` : url.host
  return label.length > 28 ? `${label.slice(0, 27)}…` : label
}

/**
 * Touchpoints from an agent's tool labels (`Bash: pnpm dev`,
 * `mcp__chrome-devtools__navigate_page: http://localhost:3000`), newest first.
 */
export function agentTouchpoints(labels: readonly (string | undefined)[]): AgentTouchpoint[] {
  const touchpoints: AgentTouchpoint[] = []
  const seen = new Set<string>()
  for (let index = labels.length - 1; index >= 0; index -= 1) {
    const label = labels[index]
    if (!label) {
      continue
    }
    for (const match of label.match(URL_PATTERN) ?? []) {
      let url: URL
      try {
        url = new URL(trimUrl(match))
      } catch {
        continue
      }
      if (seen.has(url.href)) {
        continue
      }
      seen.add(url.href)
      touchpoints.push({
        kind: 'browser',
        label: browserLabel(url),
        url: url.href
      })
    }
    if (SIMULATOR_PATTERN.test(label) && !seen.has('simulator')) {
      seen.add('simulator')
      touchpoints.push({ kind: 'simulator', label: 'Simulator' })
    }
    if (touchpoints.length >= AGENT_TOUCHPOINTS_MAX) {
      break
    }
  }
  return touchpoints.slice(0, AGENT_TOUCHPOINTS_MAX)
}

/** Wire guard: touchpoints cross the dashboard bridge from another renderer. */
export function isAgentTouchpointList(value: unknown): value is AgentTouchpoint[] {
  return (
    Array.isArray(value) &&
    value.length <= AGENT_TOUCHPOINTS_MAX &&
    value.every((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        return false
      }
      const touchpoint = entry as Record<string, unknown>
      return (
        (touchpoint.kind === 'browser' || touchpoint.kind === 'simulator') &&
        typeof touchpoint.label === 'string' &&
        touchpoint.label.length > 0 &&
        touchpoint.label.length <= TOUCHPOINT_MAX_TEXT_LENGTH &&
        (touchpoint.url === undefined ||
          (typeof touchpoint.url === 'string' &&
            touchpoint.url.length <= TOUCHPOINT_MAX_TEXT_LENGTH))
      )
    })
  )
}
