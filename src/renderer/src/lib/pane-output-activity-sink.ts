/**
 * Feeds main's throttled output-activity facts into the store, so the agent
 * dashboard can tell a hook-silent tool call that is still printing from a
 * hung one. Installed once at startup; hidden panes have no other path.
 */

import { useAppStore } from '@/store'
import { registerTerminalOutputActivitySink } from '@/components/terminal-pane/terminal-side-effect-facts-handler'

export function installPaneOutputActivitySink(): () => void {
  registerTerminalOutputActivitySink((paneKey, at) =>
    useAppStore.getState().notePaneOutputActivity(paneKey, at)
  )
  return () => registerTerminalOutputActivitySink(null)
}
