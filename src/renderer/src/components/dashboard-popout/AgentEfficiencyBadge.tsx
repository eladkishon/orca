import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import {
  agentEfficiency,
  formatTokenCount,
  type AgentEfficiencyInput
} from '../../../../shared/agent-efficiency'

/**
 * How much this agent (or project) has spent, and whether that looks reasonable.
 *
 * Deliberately one glyph-sized thing: the number is the fact and the colour is
 * the judgement, with the reasoning behind a tooltip. A card has room for a
 * verdict, not a report — the Efficiency panel is where the reasoning lives.
 */

const GRADE_STYLES = {
  efficient: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
  mixed: 'bg-amber-500/12 text-amber-700 dark:text-amber-300',
  costly: 'bg-destructive/12 text-destructive',
  unknown: 'bg-muted-foreground/10 text-muted-foreground'
} as const

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
  const reuse =
    efficiency.cacheReuseRate === null ? null : Math.round(efficiency.cacheReuseRate * 100)
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-px text-[10px] font-medium tabular-nums',
            GRADE_STYLES[efficiency.grade],
            className
          )}
        >
          {formatTokenCount(efficiency.totalTokens)}
          {reuse === null ? null : (
            <span className="opacity-70">
              {translate('dashboardPopout.efficiency.reuseShort', '{{percent}}% reused', {
                percent: reuse
              })}
            </span>
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4} className="max-w-64">
        {efficiency.headline}
        {efficiency.tokensPerTurn === null
          ? null
          : ` ${translate('dashboardPopout.efficiency.perStepTooltip', '{{tokens}} per step over {{steps}} steps.', { tokens: formatTokenCount(efficiency.tokensPerTurn), steps: usage.turns })}`}
      </TooltipContent>
    </Tooltip>
  )
}
