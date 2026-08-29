import type { Terminal } from '@xterm/xterm'

/**
 * Scales an oversized preview terminal down to the box it is shown in, and
 * anchors whichever end keeps the CURSOR row in view: a fresh shell prompts at
 * the TOP of its screen (blind bottom-anchoring clipped it away), while a busy
 * TUI keeps its action at the bottom.
 */
export function fitPreviewTerminalToBox(container: HTMLElement, terminal: Terminal): void {
  const screen = container.querySelector<HTMLElement>('.xterm-screen')
  const box = container.parentElement
  if (!screen || !box) {
    return
  }
  const scale = Math.min(1, box.clientWidth / Math.max(1, screen.offsetWidth))
  container.style.transform = scale < 1 ? `scale(${scale})` : ''
  const cellHeight = screen.offsetHeight / Math.max(1, terminal.rows)
  const cursorBottom = (terminal.buffer.active.cursorY + 1) * cellHeight * scale
  const anchorTop = cursorBottom <= box.clientHeight
  box.style.alignItems = anchorTop ? 'flex-start' : 'flex-end'
  container.style.transformOrigin = anchorTop ? 'top left' : 'bottom left'
}
