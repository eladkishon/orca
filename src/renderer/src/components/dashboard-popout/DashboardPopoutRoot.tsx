import { lazy, Suspense, useEffect } from 'react'
import { Toaster } from '@/components/ui/sonner'
import { useAppStore } from '@/store'
import { registerRateLimitIpcBridge } from '@/hooks/ipc-events/rate-limit-ipc-bridge'
import { AgentKanbanBoard } from './AgentKanbanBoard'
import { useDashboardSnapshot } from './useDashboardSnapshot'

const StatusBar = lazy(() =>
  import('../status-bar/StatusBar').then((module) => ({ default: module.StatusBar }))
)

/** The pop-out owns a separate store, so the bar's usage and layout state has
 *  to be pulled in here — the main window's startup hydration never ran. */
function usePopoutStatusBarHydration(): void {
  useEffect(() => {
    const unsubs: (() => void)[] = []
    registerRateLimitIpcBridge(unsubs)
    void window.api.ui
      .get()
      .then((persisted) => useAppStore.getState().hydratePersistedUI(persisted, 'sync'))
      .catch(() => undefined)
    return () => {
      for (const unsub of unsubs) {
        unsub()
      }
    }
  }, [])
}

/**
 * Root of the pop-out dashboard window. Subscribes to the live snapshot relayed
 * from the main window and renders the agent board.
 */
export function DashboardPopoutRoot(): React.JSX.Element {
  const snapshot = useDashboardSnapshot()
  usePopoutStatusBarHydration()
  // Why its own toaster: this window is a separate React root, so a failure
  // reported here reached the main window's toaster, which is to say nowhere.
  return (
    <div className="flex h-screen w-screen flex-col">
      <AgentKanbanBoard snapshot={snapshot} containerClassName="min-h-0 w-full flex-1" />
      <Suspense fallback={null}>
        <StatusBar floatingTerminalOpen={false} />
      </Suspense>
      <Toaster closeButton toastOptions={{ className: 'font-sans text-sm' }} />
    </div>
  )
}
