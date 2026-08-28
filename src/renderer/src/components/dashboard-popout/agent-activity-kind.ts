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
 * Every pattern starts by refusing to match inside a path, a hostname or a
 * filename: `curl https://example.test` is not testing, `cd src/build` is not
 * building, and `src/app.test.ts` names a file rather than an action.
 */
const NOT_INSIDE_A_PATH = String.raw`(?<![\w./-])`

const BASH_COMMAND_KINDS: readonly { kind: AgentActivityKind; pattern: RegExp }[] = [
  { kind: 'browsing', pattern: new RegExp(`${NOT_INSIDE_A_PATH}(?:curl|wget|httpie)\\b`, 'i') },
  {
    kind: 'testing',
    pattern: new RegExp(
      `${NOT_INSIDE_A_PATH}(?:test|vitest|jest|pytest|playwright|cypress|rspec)\\b`,
      'i'
    )
  },
  {
    kind: 'building',
    pattern: new RegExp(
      `${NOT_INSIDE_A_PATH}(?:build|tsc|typecheck|compile|webpack|vite|cargo|make|lint|oxlint)\\b`,
      'i'
    )
  },
  { kind: 'versioning', pattern: new RegExp(`${NOT_INSIDE_A_PATH}(?:git|gh|glab)\\b`, 'i') },
  { kind: 'searching', pattern: new RegExp(`${NOT_INSIDE_A_PATH}(?:rg|grep|find|ag|fd)\\b`, 'i') },
  { kind: 'reading', pattern: new RegExp(`${NOT_INSIDE_A_PATH}(?:cat|head|tail|less|ls)\\b`, 'i') }
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
    return BASH_COMMAND_KINDS.find(({ pattern }) => pattern.test(detail))?.kind ?? 'running'
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

function shellTarget(command: string): string | undefined {
  // Why: `cd x && pnpm vitest run` is about vitest, not about cd. Walk past the
  // wrappers and the flags to the first token that names something.
  const segments = command.split(/&&|\|\||;|\|/u)
  const meaningful = segments.at(-1)?.trim() || segments[0]?.trim()
  const words = (meaningful ?? '').split(/\s+/u).filter((word) => word && !word.startsWith('-'))
  const named = words.filter((word) => !SHELL_WRAPPERS.has(word.toLowerCase()))
  // Why: an argument is usually a path, and the badge wants the thing operated
  // on rather than where it lives — `rm "/var/folders/…/orca-paste"` is about
  // orca-paste.
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
