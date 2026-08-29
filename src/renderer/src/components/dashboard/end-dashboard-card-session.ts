import { CLOSE_TERMINAL_PANE_EVENT, type CloseTerminalPaneDetail } from '@/constants/terminal'
import { closeTerminalTab } from '@/components/terminal/terminal-tab-actions'
import { mountedRuntimeTerminalPaneCount } from '@/runtime/sync-runtime-graph'

/**
 * End the one session a dashboard card names.
 *
 * Why not closeTerminalTab: a tab holds a grid of panes and the card is one of
 * them — closing the tab ended every sibling session with it. The pane close
 * runs through the same event the CLI and mobile use, so the manager promotes
 * a sibling; a card that is the tab's only pane still closes the tab, with its
 * running-process confirm.
 */
export function endDashboardCardSession(target: { tabId: string; leafId?: string | null }): void {
  if (target.leafId && mountedRuntimeTerminalPaneCount(target.tabId) > 1) {
    const detail: CloseTerminalPaneDetail = { tabId: target.tabId, leafId: target.leafId }
    window.dispatchEvent(
      new CustomEvent<CloseTerminalPaneDetail>(CLOSE_TERMINAL_PANE_EVENT, { detail })
    )
    return
  }
  closeTerminalTab(target.tabId)
}
