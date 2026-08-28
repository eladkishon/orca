import { useAppStore } from '@/store'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'

/**
 * How much of this week's budget the active account has spent.
 *
 * Provider-level by nature: the weekly window belongs to whichever account is
 * signed in, not to a project or an agent. It sits in the board header for that
 * reason — putting a percentage of one shared budget on every card would imply
 * each card had its own.
 */

function formatResetsIn(resetsAt: number | null, now: number): string | null {
  if (!resetsAt || resetsAt <= now) {
    return null
  }
  const hours = Math.round((resetsAt - now) / 3_600_000)
  if (hours < 24) {
    return translate('dashboardPopout.budget.resetsHours', 'resets in {{count}}h', {
      count: Math.max(1, hours)
    })
  }
  return translate('dashboardPopout.budget.resetsDays', 'resets in {{count}}d', {
    count: Math.round(hours / 24)
  })
}

export function WeeklyBudgetBadge(): React.JSX.Element | null {
  const weekly = useAppStore((state) => state.rateLimits?.claude?.weekly)
  if (!weekly) {
    // Why nothing: a provider that has not reported a weekly window has not
    // told us there is no budget, only that it has not said. A "0%" would be a
    // claim Orca cannot support.
    return null
  }
  const percent = Math.round(weekly.usedPercent)
  const resets = formatResetsIn(weekly.resetsAt, Date.now())
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums',
            percent >= 90
              ? 'bg-destructive/12 text-destructive'
              : percent >= 70
                ? 'bg-amber-500/12 text-amber-700 dark:text-amber-300'
                : 'bg-muted-foreground/10 text-muted-foreground'
          )}
        >
          {translate('dashboardPopout.budget.weekly', '{{percent}}% of week', { percent })}
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={4}>
        {[
          translate(
            'dashboardPopout.budget.tooltip',
            "{{percent}}% of the signed-in account's weekly limit used",
            { percent }
          ),
          resets
        ]
          .filter(Boolean)
          .join(' · ')}
      </TooltipContent>
    </Tooltip>
  )
}
