/**
 * Watches one agent pane's PTY bytes for the login/network failures that leave
 * the agent stalled mid-task, so Orca can continue it.
 *
 * Mirrors the shape of codex-backfill-error-detector.ts, with two differences
 * forced by the problem: it re-arms (an agent can stall again after a
 * successful recovery), and it de-duplicates, because an agent TUI repaints the
 * same error line on every frame.
 */

import {
  classifyAgentStallLine,
  type AgentStallSignature
} from '../../../../shared/agent-stall-signature'

/** OSC (title, hyperlink, clipboard) — never carries agent prose. */
// eslint-disable-next-line no-control-regex -- terminal escape sequences contain control bytes
const OSC_PATTERN = /\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)?/g
/** SGR only styles, so text on either side is still the SAME screen line. */
// eslint-disable-next-line no-control-regex -- terminal escape sequences contain control bytes
const SGR_PATTERN = /\u001b\[[0-9;:]*m/g
/** Every other escape (cursor motion, erase, mode set) breaks the line. */
// eslint-disable-next-line no-control-regex -- terminal escape sequences contain control bytes
const LINE_BREAKING_ESCAPE_PATTERN = /\u001b(?:\[[0-9;?]*[ -/]*[@-~]|[@-Z\\-_])/g

const DETECTOR_BUFFER_MAX_CHARS = 4096
/** A repainting TUI shows the same failure every frame; report it once. */
export const AGENT_STALL_REPEAT_COOLDOWN_MS = 60_000

export type AgentStallDetection = AgentStallSignature & { at: number }

export type AgentStallDetector = { observe(chunk: string): AgentStallDetection | null }

/** Turns raw PTY bytes into candidate screen lines. Exported for tests. */
export function toAgentStallCandidateLines(chunk: string): string[] {
  return chunk
    .replace(OSC_PATTERN, '')
    .replace(SGR_PATTERN, '')
    .replace(LINE_BREAKING_ESCAPE_PATTERN, '\n')
    .split(/[\r\n]+/)
}

export function createAgentStallDetector(options: { now?: () => number } = {}): AgentStallDetector {
  const now = options.now ?? ((): number => Date.now())
  let tail = ''
  let lastReported: { key: string; at: number } | null = null

  return {
    observe(chunk: string): AgentStallDetection | null {
      if (chunk.length === 0) {
        return null
      }
      const lines = toAgentStallCandidateLines(tail + chunk)
      // Why keep the last line as tail: a failure message can be split across
      // PTY chunks, and only a completed line can be classified safely.
      tail = (lines.pop() ?? '').slice(-DETECTOR_BUFFER_MAX_CHARS)
      const at = now()
      for (const line of lines) {
        const signature = classifyAgentStallLine(line)
        if (!signature) {
          continue
        }
        const key = `${signature.cause}:${signature.signature}`
        if (lastReported?.key === key && at - lastReported.at < AGENT_STALL_REPEAT_COOLDOWN_MS) {
          continue
        }
        lastReported = { key, at }
        return { ...signature, at }
      }
      return null
    }
  }
}
