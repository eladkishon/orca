import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import { Trash2 } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import type { DashboardCard } from '../../../../shared/dashboard-snapshot'

/**
 * Right-click actions on a board card.
 *
 * Removal lives here as well as on idle cards because a worktree you want gone
 * is not always one whose agent has finished, and hunting for its row in
 * another window is how they accumulate. The confirm still belongs to the
 * shared delete flow — this only names the workspace.
 *
 * An agent in the project's PRIMARY checkout has no worktree to remove: git
 * refuses to delete the main tree, and offering it there would either fail or,
 * worse, be read as an offer to delete the project. That card is offered its
 * session instead, which is the thing that actually exists to end.
 */
export function AgentCardContextMenu({
  card,
  onRemoveWorkspace,
  onEndSession,
  children
}: {
  card: DashboardCard
  onRemoveWorkspace: ((card: DashboardCard) => void) | undefined
  onEndSession: ((card: DashboardCard) => void) | undefined
  children: React.ReactNode
}): React.JSX.Element {
  const action = card.isMainWorktree
    ? onEndSession
      ? {
          run: onEndSession,
          label: translate('dashboardPopout.card.endSession', 'End session')
        }
      : null
    : onRemoveWorkspace
      ? {
          run: onRemoveWorkspace,
          label: translate('dashboardPopout.card.removeWorktree', 'Remove worktree')
        }
      : null
  if (!action) {
    return <>{children}</>
  }
  return (
    <ContextMenu>
      {/* Why asChild: the trigger must stay the card itself, so the menu's hit
          area is the card rather than a wrapper that changes its layout. */}
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        <ContextMenuItem variant="destructive" onSelect={() => action.run(card)}>
          <Trash2 className="size-3.5" />
          {action.label}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
