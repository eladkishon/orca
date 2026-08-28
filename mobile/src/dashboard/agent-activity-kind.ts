// Port of the desktop board's activity classifier (src/renderer/src/components/
// dashboard-popout/agent-activity-kind.ts). Mirrored rather than imported: a
// runtime import from a root .ts breaks mobile's vitest transform.
//
// A card can say "Bash: pnpm vitest run src/…" and still not answer what you
// scan a board for — is this writing code, running tests, or reading the web?

export type AgentActivityKind =
  | 'writing'
  | 'testing'
  | 'building'
  | 'versioning'
  | 'reading'
  | 'searching'
  | 'browsing'
  | 'running'
  | 'planning'
  | 'delegating'
  | 'asking'
  | 'thinking'

const COMMAND_KINDS: readonly { kind: AgentActivityKind; pattern: RegExp }[] = [
  { kind: 'browsing', pattern: /\b(?:curl|wget|httpie)\b/i },
  { kind: 'testing', pattern: /\b(?:test|vitest|jest|pytest|playwright|cypress|rspec)\b/i },
  {
    kind: 'building',
    pattern:
      /\b(?:build|tsc|typecheck|compile|webpack|vite|cargo|make|lint|oxlint|xcodebuild|xcrun|gradlew?|swift|mvn|bazel|ninja|cmake|expo|eas|assemble\w*)\b/i
  },
  { kind: 'versioning', pattern: /\b(?:git|gh|glab)\b/i },
  { kind: 'searching', pattern: /\b(?:rg|grep|find|ag|fd)\b/i },
  { kind: 'reading', pattern: /\b(?:cat|head|tail|less|ls)\b/i }
]

const TOOL_KINDS: Readonly<Record<string, AgentActivityKind>> = {
  edit: 'writing',
  multiedit: 'writing',
  write: 'writing',
  notebookedit: 'writing',
  applypatch: 'writing',
  read: 'reading',
  notebookread: 'reading',
  glob: 'searching',
  grep: 'searching',
  search: 'searching',
  webfetch: 'browsing',
  websearch: 'browsing',
  fetch: 'browsing',
  task: 'delegating',
  agent: 'delegating',
  todowrite: 'planning',
  exitplanmode: 'planning',
  askuserquestion: 'asking'
}

const SHELL_TOOLS = new Set(['bash', 'shell', 'terminal'])

/** Shell noise that never names what a command is for. */
const SHELL_WRAPPERS = new Set([
  'cd',
  'sudo',
  'env',
  'time',
  'nohup',
  'exec',
  'source',
  '.',
  'npx',
  'pnpm',
  'npm',
  'yarn',
  'bun',
  'uv',
  'poetry'
])

/** Long enough to name a file or a package script, short enough for a badge. */
const MAX_TARGET_CHARS = 28

function splitActivity(activity: string | undefined): { tool: string; detail: string } | null {
  const trimmed = activity?.trim()
  if (!trimmed) {
    return null
  }
  const separator = trimmed.indexOf(':')
  return {
    tool: (separator === -1 ? trimmed : trimmed.slice(0, separator)).trim().toLowerCase(),
    detail: separator === -1 ? '' : trimmed.slice(separator + 1).trim()
  }
}

function basename(value: string): string {
  const withoutQuery = value.split(/[?#]/u)[0] ?? value
  const parts = withoutQuery.split(/[/\\]/u).filter(Boolean)
  return parts.at(-1) ?? value
}

/** The words that decide what a command IS: its executable plus non-path args. */
function commandWords(command: string): string {
  const segments = command.split(/&&|\|\||;|\|/u)
  const segment = segments.at(-1)?.trim() || segments[0]?.trim() || ''
  const tokens = segment.split(/\s+/u).filter((token) => token && !token.startsWith('-'))
  let executable = ''
  const args: string[] = []
  for (const token of tokens) {
    const bare = token.replaceAll(/^["'`]|["'`]$/gu, '')
    if (!executable) {
      if (SHELL_WRAPPERS.has(basename(bare).toLowerCase())) {
        continue
      }
      executable = basename(bare)
      continue
    }
    if (!/[/\\]/u.test(bare)) {
      args.push(bare)
    }
  }
  return [executable, ...args].join(' ')
}

export function agentActivityKind(activity: string | undefined): AgentActivityKind | undefined {
  const parts = splitActivity(activity)
  if (!parts) {
    return undefined
  }
  if (SHELL_TOOLS.has(parts.tool)) {
    const words = commandWords(parts.detail)
    return COMMAND_KINDS.find(({ pattern }) => pattern.test(words))?.kind ?? 'running'
  }
  return TOOL_KINDS[parts.tool] ?? 'thinking'
}

const PLATFORM_PATTERNS: readonly RegExp[] = [
  /platform=([^,'"\n]+)/i,
  /(?:^|\s)--?platform[= ]([^\s,'"]+)/i,
  /(?:^|\s)-sdk[= ]([^\s,'"]+)/i
]

function platformTarget(command: string): string | undefined {
  for (const pattern of PLATFORM_PATTERNS) {
    const match = pattern.exec(command)?.[1]?.trim()
    if (match) {
      return match
    }
  }
  return undefined
}

function shellTarget(command: string): string | undefined {
  const platform = platformTarget(command)
  if (platform) {
    return platform
  }
  const segments = command.split(/&&|\|\||;|\|/u)
  const segment = segments.at(-1)?.trim() || segments[0]?.trim() || ''
  const words = segment.split(/\s+/u).filter((word) => word && !word.startsWith('-'))
  const named = words.filter((word) => !SHELL_WRAPPERS.has(basename(word).toLowerCase()))
  const head = named
    .slice(0, 2)
    .map((word) => basename(word.replaceAll(/^["'`]|["'`]$/gu, '')))
    .join(' ')
  return head || words[0]
}

/** Hostname of a URL detail, without depending on a URL parser Hermes may lack. */
function urlHost(detail: string): string {
  return /^https?:\/\/([^/?#]+)/i.exec(detail)?.[1] ?? detail
}

/** WHAT the agent is working on — the file, host or command naming the work. */
export function agentActivityTarget(activity: string | undefined): string | undefined {
  const parts = splitActivity(activity)
  if (!parts?.detail) {
    return undefined
  }
  const raw = SHELL_TOOLS.has(parts.tool)
    ? shellTarget(parts.detail)
    : /^https?:\/\//i.test(parts.detail)
      ? urlHost(parts.detail)
      : basename(parts.detail)
  const target = raw?.replaceAll(/^["'`]|["'`]$/gu, '').trim()
  if (!target) {
    return undefined
  }
  return target.length > MAX_TARGET_CHARS ? `${target.slice(0, MAX_TARGET_CHARS - 1)}…` : target
}
