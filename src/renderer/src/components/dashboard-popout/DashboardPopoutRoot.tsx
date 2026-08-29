import { Toaster } from '@/components/ui/sonner'
import { AgentKanbanBoard } from './AgentKanbanBoard'
import { useDashboardSnapshot } from './useDashboardSnapshot'

/**
 * Root of the pop-out dashboard window. Subscribes to the live snapshot relayed
 * from the main window and renders the agent board.
 */
export function DashboardPopoutRoot(): React.JSX.Element {
  const snapshot = useDashboardSnapshot()
  // Why its own toaster: this window is a separate React root, so a failure
  // reported here reached the main window's toaster, which is to say nowhere.
  return (
    <>
      <AgentKanbanBoard snapshot={snapshot} />
      <Toaster closeButton toastOptions={{ className: 'font-sans text-sm' }} />
    </>
  )
}
