/**
 * Cuts an agent's message down to something a board card can be read at.
 *
 * The field is whatever the agent last said, which is often not prose: grep
 * hits with line-number prefixes, a stack trace, a diff, a wall of tool output.
 * Rendered as-is that fills a card with text nobody reads, and the card stops
 * answering the only question it exists to answer — what is this agent doing.
 *
 * So: flatten it to one flow, drop the scaffolding that carries no meaning at
 * card size, and stop at a word boundary. The full text is one click away in
 * the terminal; this is the headline, not the article.
 */

/** Leading line numbers from grep -n / numbered file reads: "18: ", "227: ". */
const LINE_NUMBER_PREFIX = /(^|\s)\d{1,6}:(?=\s)/g
/** Comment and block scaffolding that survives flattening as visual noise. */
const CODE_SCAFFOLDING = /(^|\s)(?:\/\*+|\*+\/|\/\/+|-{3,}|={3,}|\^+)(?=\s|$)/g

export function condenseAgentMessage(text: string, maxChars: number): string {
  const flattened = text
    .replaceAll(/\s+/gu, ' ')
    .replaceAll(LINE_NUMBER_PREFIX, '$1')
    .replaceAll(CODE_SCAFFOLDING, '$1')
    .replaceAll(/\s+/gu, ' ')
    .trim()
  if (flattened.length <= maxChars) {
    return flattened
  }
  const cut = flattened.slice(0, maxChars)
  const lastSpace = cut.lastIndexOf(' ')
  // Why: cutting mid-word reads as a rendering bug rather than as elision.
  return `${(lastSpace > maxChars * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}\u2026`
}
