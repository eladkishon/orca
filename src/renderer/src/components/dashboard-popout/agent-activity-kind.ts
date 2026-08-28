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
