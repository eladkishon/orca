import { Maximize2 } from 'lucide-react'
import { AgentIcon } from '@/lib/agent-catalog'
import { agentTypeToIconAgent } from '@/lib/agent-status'
import { agentStateLabel } from '@/components/AgentStateDot'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import {
  dashboardCardDisplayState,
  type DashboardCard
} from '../../../../shared/dashboard-snapshot'
import { AgentTerminalPreview } from './AgentTerminalPreview'
import './agent-card-state.css'

/**
 * One agent as a live, typeable terminal instead of a summary card — the board
 * grid the "Live" detail level renders.
 *
 * Each tile claims its pty's grid like the full-size preview does, so the
 * terminal is rendered at the tile's real size instead of being scaled down to
 * an unreadable thumbnail; the agent's own pane parks at that grid until the
 * grid is closed. Focus is NOT taken on paint — a dozen tiles would fight over
 * the caret. Click a tile to type in it; expand opens the full-size dialog.
 */
export function AgentLiveSessionTile({
  card,
  onOpenTerminal,
  className
}: {
  card: DashboardCard
  onOpenTerminal: (card: DashboardCard) => void
  className?: string
}): React.JSX.Element {
  return (
    <section
      className={cn(
        'agent-card-state flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card',
        className
      )}
      data-agent-state={dashboardCardDisplayState(card)}
    >
      <header className="flex shrink-0 items-center gap-1.5 px-2 py-1.5">
        <AgentIcon agent={agentTypeToIconAgent(card.agentType)} size={12} />
        <span className="truncate text-[12px] font-semibold">{card.worktreeName}</span>
        <span className="shrink-0 text-[10px] text-muted-foreground">
          {agentStateLabel(dashboardCardDisplayState(card))}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="ml-auto opacity-70 hover:opacity-100"
          onClick={() => onOpenTerminal(card)}
        >
          <Maximize2 className="size-3.5" />
          <span className="sr-only">
            {translate('dashboardPopout.card.expandSession', 'Open full size')}
          </span>
        </Button>
      </header>
      {card.ptyId ? (
        <AgentTerminalPreview
          ptyId={card.ptyId}
          terminalInput={card.terminalInput ?? null}
          autoFocus={false}
          className="h-auto min-h-0 flex-1"
        />
      ) : (
        <div className="min-h-0 flex-1 px-2 pb-2 text-[11px] text-muted-foreground">
          {translate(
            'dashboardPopout.terminal.closed',
            "No live terminal — this agent's pane has closed."
          )}
        </div>
      )}
    </section>
  )
}
