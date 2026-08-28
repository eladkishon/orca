import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import {
  agentUsageShare,
  formatCostUsd,
  formatPercent,
  formatTokenCount,
  isResentShareWorthFixing,
  type AgentEfficiencyInput
} from '../../../../shared/agent-efficiency'

/**
 * Two numbers, both of which change what you would do: how much of the week
 * went here, and how much of that was context sent again rather than re-used.
 *
 * The second is the actionable one — it is the only part of the bill that
 * caching could have removed — so it is coloured, and the first is not. A badge
 * where everything is coloured says nothing about what to look at.
 */
export function AgentEfficiencyBadge({
  usage,
  weeklyBillableTotal,
  className
}: {
  usage: AgentEfficiencyInput | undefined
  weeklyBillableTotal: number
  className?: string
}): React.JSX.Element | null {
  // Why nothing rather than a zero: an agent the usage scan has not attributed
  // is not an agent that spent nothing, and a "0%" here would say it was.
  if (!usage) {
    return null
  }
  const share = agentUsageShare(usage, weeklyBillableTotal)
  const wasteful = isResentShareWorthFixing(share)
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={translate('dashboardPopout.efficiency.open', 'Usage details')}
          onClick={(event) => event.stopPropagation()}
          className={cn(
            'inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted-foreground/10 px-1.5 py-px text-[10px] font-medium tabular-nums text-muted-foreground transition-colors hover:bg-muted-foreground/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
            className
          )}
        >
          <span>
            {translate('dashboardPopout.efficiency.ofWeek', '{{percent}} of week', {
              percent: formatPercent(share.weeklyShare)
            })}
          </span>
          {share.resentShare === null ? null : (
            <span
              className={cn(
                'rounded-full px-1',
                wasteful
                  ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                  : 'text-muted-foreground/70'
              )}
            >
              {translate('dashboardPopout.efficiency.resentShort', '{{percent}} re-sent', {
                percent: formatPercent(share.resentShare)
              })}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={6} className="w-72 space-y-2.5 p-3">
        <div className="space-y-1">
          <p className="text-[12px] font-semibold text-foreground">
            {translate('dashboardPopout.efficiency.weekTitle', '{{percent}} of this week', {
              percent: formatPercent(share.weeklyShare)
            })}
          </p>
          <p className="text-[11px] leading-[1.5] text-muted-foreground">
            {translate(
              'dashboardPopout.efficiency.weekBody',
              'Share of everything Orca billed across your projects in the last 7 days.'
            )}
          </p>
        </div>
        <div className="space-y-1 border-t border-border/60 pt-2.5">
          <p className="text-[12px] font-semibold text-foreground">
            {translate('dashboardPopout.efficiency.resentTitle', '{{percent}} re-sent context', {
              percent: formatPercent(share.resentShare)
            })}
          </p>
          <p className="text-[11px] leading-[1.5] text-muted-foreground">
            {wasteful
              ? translate(
                  'dashboardPopout.efficiency.resentBodyHigh',
                  'That much of the bill was context sent again at full price instead of re-used from cache. Shorter sessions and fewer restarts are what bring it down.'
                )
              : translate(
                  'dashboardPopout.efficiency.resentBodyLow',
                  'Most of the context was re-used from cache rather than sent again, which is the cheap path.'
                )}
          </p>
        </div>
        <dl className="space-y-1 border-t border-border/60 pt-2.5">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-[11px] text-muted-foreground">
              {translate('dashboardPopout.efficiency.billable', 'Billed')}
            </dt>
            <dd className="text-[11px] font-medium tabular-nums text-foreground">
              {share.estimatedCostUsd === null
                ? formatTokenCount(share.billableTokens)
                : `${formatCostUsd(share.estimatedCostUsd)} · ${formatTokenCount(share.billableTokens)}`}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-[11px] text-muted-foreground">
              {translate('dashboardPopout.efficiency.reused', 'Re-used from cache')}
            </dt>
            <dd className="text-[11px] font-medium tabular-nums text-foreground">
              {formatTokenCount(share.reusedTokens)}
            </dd>
          </div>
        </dl>
      </PopoverContent>
    </Popover>
  )
}
