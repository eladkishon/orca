/**
 * What KIND of work an agent is doing, from the tool it is running.
 *
 * A card can say "Bash: pnpm vitest run src/..." and still not answer the
 * question you actually scan a board for — is this thing writing code, running
 * tests, or reading the internet? The tool name already knows; it just needs
 * saying in words a person uses.
 *
 * Bash is the interesting case, because every agent funnels most of its real
 * work through it. The command itself is classified rather than left as
 * "running a command", which would be true of half the board at any moment and
 * therefore worth nothing.
 */

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

/**
 * Matched in order; the first hit wins, so specific patterns come first.
 *
 * These run against the command's EXECUTABLE and its plain arguments, never
 * against a path. Trying to express that as a lookbehind failed both ways:
 * `src/build` matched as building, and guarding against it then stopped
 * `./gradlew` and `xcodebuild` from matching at all.
 */
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

/**
 * `activity` is the "Bash: pnpm test" line the card already carries, so this
 * needs no extra field on the wire.
 */
export function agentActivityKind(activity: string | undefined): AgentActivityKind | undefined {
  const trimmed = activity?.trim()
  if (!trimmed) {
    return undefined
  }
  const separator = trimmed.indexOf(':')
  const tool = (separator === -1 ? trimmed : trimmed.slice(0, separator)).trim().toLowerCase()
  const detail = separator === -1 ? '' : trimmed.slice(separator + 1).trim()
  if (tool === 'bash' || tool === 'shell' || tool === 'terminal') {
    const words = commandWords(detail)
    return COMMAND_KINDS.find(({ pattern }) => pattern.test(words))?.kind ?? 'running'
  }
  return TOOL_KINDS[tool] ?? 'thinking'
}

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

function basename(value: string): string {
  const withoutQuery = value.split(/[?#]/u)[0] ?? value
  const parts = withoutQuery.split(/[/\\]/u).filter(Boolean)
  return parts.at(-1) ?? value
}

/** `-destination 'platform=iOS Simulator,id=…'`, `-sdk iphoneos`, `--platform android`. */
const PLATFORM_PATTERNS: readonly RegExp[] = [
  /platform=([^,'"\n]+)/i,
  /(?:^|\s)--?platform[= ]([^\s,'"]+)/i,
  /(?:^|\s)-sdk[= ]([^\s,'"]+)/i
]

/**
 * The platform a build or test is aimed at, which is the thing worth knowing:
 * "Building" and "Building · iOS Simulator" answer very different questions
 * when a six-minute xcodebuild is what you are looking at.
 */
function platformTarget(command: string): string | undefined {
  for (const pattern of PLATFORM_PATTERNS) {
    const match = pattern.exec(command)?.[1]?.trim()
    if (match) {
      return match
    }
  }
  return undefined
}

/**
 * The words that decide what a command IS: its executable, plus the arguments
 * that are not paths.
 *
 * A path is where work happens, not what the work is — `cd src/build` is not a
 * build and `curl https://example.test` is not a test run. The executable is
 * the exception: it is often invoked BY path (`./gradlew`), so it contributes
 * its basename.
 */
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

/**
 * Unlike classification, the target WANTS the paths — reduced to basenames.
 * `rm "/var/folders/…/orca-paste"` is about orca-paste; that it lives under
 * /var is not the interesting part, but the name is.
 */
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

/**
 * WHAT the agent is working on, for the badge — the file, host or command that
 * names the work. The kind alone says the verb; a board full of "Running a
 * command" still cannot tell one agent from the next.
 */
export function agentActivityTarget(activity: string | undefined): string | undefined {
  const trimmed = activity?.trim()
  const separator = trimmed?.indexOf(':') ?? -1
  if (!trimmed || separator === -1) {
    return undefined
  }
  const tool = trimmed.slice(0, separator).trim().toLowerCase()
  const detail = trimmed.slice(separator + 1).trim()
  if (!detail) {
    return undefined
  }
  const raw =
    tool === 'bash' || tool === 'shell' || tool === 'terminal'
      ? shellTarget(detail)
      : /^https?:\/\//i.test(detail)
        ? (URL.parse(detail)?.hostname ?? detail)
        : basename(detail)
  const target = raw?.replaceAll(/^["'`]|["'`]$/gu, '').trim()
  if (!target) {
    return undefined
  }
  return target.length > MAX_TARGET_CHARS
    ? `${target.slice(0, MAX_TARGET_CHARS - 1)}\u2026`
    : target
}
