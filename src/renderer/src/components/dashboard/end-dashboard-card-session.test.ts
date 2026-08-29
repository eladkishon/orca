// @vitest-environment happy-dom

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { CLOSE_TERMINAL_PANE_EVENT } from '@/constants/terminal'

const closeTerminalTab = vi.fn()
let paneCount = 0

vi.mock('@/components/terminal/terminal-tab-actions', () => ({
  closeTerminalTab: (...args: unknown[]) => closeTerminalTab(...args)
}))
vi.mock('@/runtime/sync-runtime-graph', () => ({
  mountedRuntimeTerminalPaneCount: () => paneCount
}))

import { endDashboardCardSession } from './end-dashboard-card-session'

describe('endDashboardCardSession', () => {
  beforeEach(() => {
    closeTerminalTab.mockClear()
  })

  it('closes only the named pane when the tab holds a grid', () => {
    paneCount = 3
    const seen: unknown[] = []
    const listener = (event: Event): void => {
      seen.push((event as CustomEvent).detail)
    }
    window.addEventListener(CLOSE_TERMINAL_PANE_EVENT, listener)
    endDashboardCardSession({ tabId: 't1', leafId: 'leaf-2' })
    window.removeEventListener(CLOSE_TERMINAL_PANE_EVENT, listener)
    expect(seen).toEqual([{ tabId: 't1', leafId: 'leaf-2' }])
    expect(closeTerminalTab).not.toHaveBeenCalled()
  })

  it('closes the tab for the last pane, and when the pane is unknown', () => {
    paneCount = 1
    endDashboardCardSession({ tabId: 't1', leafId: 'leaf-1' })
    paneCount = 3
    endDashboardCardSession({ tabId: 't2', leafId: null })
    expect(closeTerminalTab.mock.calls).toEqual([['t1'], ['t2']])
  })
})
