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
 */
export function AgentCardContextMenu({
  card,
  onRemoveWorkspace,
  children
}: {
  card: DashboardCard
  onRemoveWorkspace: ((card: DashboardCard) => void) | undefined
  children: React.ReactNode
}): React.JSX.Element {
  if (!onRemoveWorkspace) {
    return <>{children}</>
  }
  return (
    <ContextMenu>
      {/* Why asChild: the trigger must stay the card itself, so the menu's hit
          area is the card rather than a wrapper that changes its layout. */}
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        <ContextMenuItem variant="destructive" onSelect={() => onRemoveWorkspace(card)}>
          <Trash2 className="size-3.5" />
          {translate('dashboardPopout.card.removeWorktree', 'Remove worktree')}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
