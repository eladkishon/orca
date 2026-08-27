/**
 * Turns an agent's raw terminal bytes into the few readable lines that say what
 * it is doing right now.
 *
 * The board wants the information, not the terminal: agent CLIs draw framed
 * TUIs, redraw lines in place with a bare CR, and animate spinners, none of
 * which mean anything once the pixels are gone. This keeps the prose and drops
 * the chrome, so a card can say "Editing src/app.ts" instead of a box corner.
 */

import { stripAnsiEscapeSequences } from './ansi-escape-sequences'

/** Box drawing and block elements — borders, never content. */
const FRAME_CHARACTERS = /[\u2500-\u259f]/gu
/** Braille blocks are how every one of these CLIs animates a spinner. */
const SPINNER_CHARACTERS = /[\u2800-\u28ff]/gu
/** A line that survives stripping but carries no words or digits is chrome. */
const HAS_CONTENT = /[\p{L}\p{N}]/u

/**
 * Standing UI the CLIs paint every frame: key hints, mode banners, context and
 * token meters, and the empty input prompt. They are always on screen, so
 * without this they are always the newest lines and crowd out the work.
 */
const NOISE_PATTERNS: readonly RegExp[] = [
  /^[?>$#%]\s*$/u,
  /\bfor shortcuts\b/iu,
  /\bto interrupt\b/iu,
  /\bto (?:accept|reject|cycle|expand|toggle|skip|exit|quit|undo)\b/iu,
  /\bctrl\s*\+?\s*[a-z]\b/iu,
  /\bshift\s*\+\s*tab\b/iu,
  /\b(?:esc|escape)\s+(?:esc\s+)?to\b/iu,
  /\bauto-?(?:compact|accept)\b/iu,
  /\bcontext (?:left|remaining|window)\b/iu,
  /\b(?:tokens?|context) (?:used|left|remaining)\b/iu,
  /^\s*\d+(?:\.\d+)?[km]?\s*tokens?\b/iu,
  /\bpress\s+\S+\s+to\b/iu,
  /\byes,?\s+and\b.*\bno\b/iu
]

function isStandingUi(line: string): boolean {
  return NOISE_PATTERNS.some((pattern) => pattern.test(line))
}

/** Bounds the work: the tail is a handful of lines, not a session transcript. */
const MAX_SCANNED_CHARS = 64 * 1024

function readableLine(rawLine: string): string {
  // Why: a progress line is redrawn in place with a bare CR, so only the text
  // after the last CR was ever on screen.
  const lastDrawn = rawLine.slice(rawLine.lastIndexOf('\r') + 1)
  return lastDrawn
    .replace(FRAME_CHARACTERS, ' ')
    .replace(SPINNER_CHARACTERS, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
}

/**
 * The last `maxLines` readable lines of `raw`, newest last. Returns fewer (or
 * none) when the terminal is showing only chrome.
 */
export function agentTerminalActivityTail(raw: string, maxLines = 3): string[] {
  if (!raw) {
    return []
  }
  const scanned = raw.length > MAX_SCANNED_CHARS ? raw.slice(raw.length - MAX_SCANNED_CHARS) : raw
  const lines = stripAnsiEscapeSequences(scanned).split('\n')
  const tail: string[] = []
  for (let index = lines.length - 1; index >= 0 && tail.length < maxLines; index -= 1) {
    const line = readableLine(lines[index])
    // Why: a redrawn TUI leaves the same status repeated down the buffer, which
    // reads as padding rather than as more information.
    if (!HAS_CONTENT.test(line) || isStandingUi(line) || line === tail.at(-1)) {
      continue
    }
    tail.push(line)
  }
  return tail.toReversed()
}
