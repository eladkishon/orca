/** A session tab as far as the board's preview cares: which terminal, whose agent. */
export type PreviewSessionTab = {
  id?: string
  type?: string
  terminal?: string | null
  agentStatus?: { paneKey?: string } | null
}

/**
 * The terminal behind a board card: the tab running that very agent, else the
 * workspace's first live terminal, so a preview still opens when the host's
 * agent status has not caught up with the pane.
 */
export function pickAgentTerminalTab(
  tabs: readonly PreviewSessionTab[],
  agentPaneKey: string | undefined
): PreviewSessionTab | null {
  const terminals = tabs.filter(
    (tab) => tab.type === 'terminal' && typeof tab.terminal === 'string'
  )
  const own = agentPaneKey
    ? terminals.find((tab) => tab.agentStatus?.paneKey === agentPaneKey)
    : undefined
  return own ?? terminals[0] ?? null
}

export type PreviewTerminalStreamEvent = {
  type?: unknown
  chunk?: unknown
  serialized?: unknown
  cols?: unknown
  rows?: unknown
}

export type PreviewTerminalSink = {
  init: (cols: number, rows: number, initialData?: string) => void
  write: (chunk: string) => void
}

/** Applies one JSON terminal-stream event to the preview's xterm. */
export function applyPreviewTerminalEvent(
  event: PreviewTerminalStreamEvent,
  sink: PreviewTerminalSink
): void {
  if (event.type === 'scrollback') {
    sink.init(
      typeof event.cols === 'number' ? event.cols : 80,
      typeof event.rows === 'number' ? event.rows : 24,
      typeof event.serialized === 'string' ? event.serialized : ''
    )
    return
  }
  if (event.type === 'data' && typeof event.chunk === 'string') {
    sink.write(event.chunk)
  }
}
