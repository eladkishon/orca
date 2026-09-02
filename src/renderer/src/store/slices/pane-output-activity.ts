import type { StateCreator } from 'zustand'
import type { AppState } from '../types'

/**
 * When each pane's PTY last printed anything, from main's throttled
 * output-activity facts. Hook status says what an agent claims to be doing;
 * this says whether its terminal is still moving, hidden panes included.
 */
export type PaneOutputActivitySlice = {
  paneOutputActivityAtByPaneKey: Record<string, number>
  notePaneOutputActivity: (paneKey: string, at: number) => void
  clearPaneOutputActivityByTabPrefix: (tabIdPrefix: string) => void
}

export const createPaneOutputActivitySlice: StateCreator<
  AppState,
  [],
  [],
  PaneOutputActivitySlice
> = (set) => ({
  paneOutputActivityAtByPaneKey: {},
  notePaneOutputActivity: (paneKey, at) => {
    if (!paneKey) {
      return
    }
    set((s) =>
      (s.paneOutputActivityAtByPaneKey[paneKey] ?? 0) >= at
        ? s
        : { paneOutputActivityAtByPaneKey: { ...s.paneOutputActivityAtByPaneKey, [paneKey]: at } }
    )
  },
  clearPaneOutputActivityByTabPrefix: (tabIdPrefix) => {
    set((s) => buildPaneOutputActivityTabPrefixClearPatch(s, [`${tabIdPrefix}:`]) ?? s)
  }
})

/** Retired pane keys never recur, so the retired-tab sweep drops them here. */
export function buildPaneOutputActivityTabPrefixClearPatch(
  state: Partial<Pick<PaneOutputActivitySlice, 'paneOutputActivityAtByPaneKey'>>,
  tabPrefixes: readonly string[]
): Pick<PaneOutputActivitySlice, 'paneOutputActivityAtByPaneKey'> | null {
  const current = state.paneOutputActivityAtByPaneKey
  if (!current) {
    return null
  }
  const doomed = Object.keys(current).filter((paneKey) =>
    tabPrefixes.some((prefix) => paneKey.startsWith(prefix))
  )
  if (doomed.length === 0) {
    return null
  }
  const next = { ...current }
  for (const paneKey of doomed) {
    delete next[paneKey]
  }
  return { paneOutputActivityAtByPaneKey: next }
}
