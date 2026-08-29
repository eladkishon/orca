/** Clipboard text dropped into a composer draft at the caret. */
export function insertComposerText(
  value: string,
  cursor: number,
  text: string
): { text: string; cursor: number } {
  const at = Math.max(0, Math.min(cursor, value.length))
  return { text: `${value.slice(0, at)}${text}${value.slice(at)}`, cursor: at + text.length }
}
