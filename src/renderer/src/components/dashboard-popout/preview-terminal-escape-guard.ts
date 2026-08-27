/**
 * Keeps a bare Escape out of the preview's PTY.
 *
 * A pop-out preview is a glance surface, and Escape there means "back out of
 * this" the way it does in every other dialog. Forwarding it interrupted the
 * agent instead — a destructive outcome for the key people press to leave.
 * Ctrl+C stays the interrupt. Modified Escape still reaches the agent, since
 * only the bare keystroke carries the conflicting meaning.
 */
export function previewTerminalSwallowsKey(event: KeyboardEvent): boolean {
  return (
    event.type === 'keydown' &&
    event.key === 'Escape' &&
    !event.ctrlKey &&
    !event.altKey &&
    !event.metaKey &&
    !event.shiftKey
  )
}
