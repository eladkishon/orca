import { Loader2 } from 'lucide-react'
import { AgentIcon, getAgentLabel } from '@/lib/agent-catalog'
import { translate } from '@/i18n/i18n'
import type { PendingSpawn } from './board-pending-actions'

/**
 * A card for an agent that has been asked for but has not started yet.
 *
 * Starting an agent takes seconds, and until now the board showed nothing at
 * all for them — the button was pressed, the column did not move, so the
 * natural reading was that the click had missed.
 */
export function PendingSpawnCard({ spawn }: { spawn: PendingSpawn }): React.JSX.Element {
  return (
    <div
      className="flex items-center gap-2 rounded-lg border border-dashed border-border/70 bg-card/40 px-3 py-2.5 text-xs text-muted-foreground"
      aria-live="polite"
    >
      <AgentIcon agent={spawn.agent} size={14} />
      <span className="min-w-0 flex-1 truncate font-medium text-foreground/80">
        {getAgentLabel(spawn.agent)}
      </span>
      <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
      <span className="shrink-0">{translate('dashboardPopout.card.starting', 'Starting…')}</span>
    </div>
  )
}
