import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import {
  agentEfficiency,
  formatCostUsd,
  formatTokenCount,
  type AgentEfficiencyInput
} from '../../../../shared/agent-efficiency'

/**
 * What this agent (or project) cost, with the working shown on demand.
 *
 * The badge carries the two figures that actually differ between agents — what
 * the turns cost, and how much each step paid for. Everything else is one click
 * away rather than crowded onto a card: a badge that shows five numbers is read
 * as none of them.
 */

const GRADE_STYLES = {
  efficient: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20',
  mixed: 'bg-amber-500/12 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20',
  costly: 'bg-destructive/12 text-destructive hover:bg-destructive/20',
  unknown: 'bg-muted-foreground/10 text-muted-foreground hover:bg-muted-foreground/20'
} as const

function Figure({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="text-[11px] font-medium tabular-nums text-foreground">{value}</dd>
    </div>
  )
}

export function AgentEfficiencyBadge({
  usage,
  className
}: {
  usage: AgentEfficiencyInput | undefined
  className?: string
}): React.JSX.Element | null {
  // Why nothing rather than a zero: an agent the usage scan has not attributed
  // is not an agent that spent nothing, and a "0" here would say it was.
  if (!usage) {
    return null
  }
  const efficiency = agentEfficiency(usage)
  const perStep =
    efficiency.billablePerTurn === null ? null : formatTokenCount(efficiency.billablePerTurn)
  const headline =
    efficiency.estimatedCostUsd === null
      ? formatTokenCount(efficiency.billableTokens)
      : formatCostUsd(efficiency.estimatedCostUsd)
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={translate('dashboardPopout.efficiency.open', 'Efficiency details')}
          onClick={(event) => event.stopPropagation()}
          className={cn(
            'inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-px text-[10px] font-medium tabular-nums transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
            GRADE_STYLES[efficiency.grade],
            className
          )}
        >
          {headline}
          {perStep ? (
            <span className="opacity-70">
              {translate('dashboardPopout.efficiency.perStepShort', '{{tokens}}/step', {
                tokens: perStep
              })}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={6} className="w-64 space-y-2 p-3">
        <p className="text-[11px] leading-[1.5] text-foreground/85">{efficiency.headline}</p>
        <dl className="space-y-1 border-t border-border/60 pt-2">
          <Figure
            label={translate('dashboardPopout.efficiency.steps', 'Steps')}
            value={String(usage.turns)}
          />
          <Figure
            label={translate('dashboardPopout.efficiency.perStep', 'Billable per step')}
            value={perStep ?? '—'}
          />
          <Figure
            label={translate('dashboardPopout.efficiency.billable', 'Billable total')}
            value={formatTokenCount(efficiency.billableTokens)}
          />
          <Figure
            label={translate('dashboardPopout.efficiency.input', 'Sent')}
            value={formatTokenCount(usage.inputTokens)}
          />
          <Figure
            label={translate('dashboardPopout.efficiency.output', 'Written')}
            value={formatTokenCount(usage.outputTokens)}
          />
          <Figure
            label={translate('dashboardPopout.efficiency.cacheWrite', 'Cached')}
            value={formatTokenCount(usage.cacheWriteTokens)}
          />
          <Figure
            label={translate('dashboardPopout.efficiency.reused', 'Re-used from cache')}
            value={`${formatTokenCount(efficiency.reusedTokens)}${
              efficiency.cacheReuseRate === null
                ? ''
                : ` (${Math.round(efficiency.cacheReuseRate * 100)}%)`
            }`}
          />
          {efficiency.estimatedCostUsd === null ? null : (
            <Figure
              label={translate('dashboardPopout.efficiency.cost', 'Estimated cost')}
              value={formatCostUsd(efficiency.estimatedCostUsd)}
            />
          )}
        </dl>
        {/* Why say this: re-used tokens are excluded from the totals above, and
            a reader comparing them to a provider dashboard deserves to know. */}
        <p className="text-[10px] leading-[1.45] text-muted-foreground">
          {translate(
            'dashboardPopout.efficiency.note',
            'Totals count what the turns paid for. Cache reads are listed separately — they are re-used context, billed at a fraction of the price.'
          )}
        </p>
      </PopoverContent>
    </Popover>
  )
}
