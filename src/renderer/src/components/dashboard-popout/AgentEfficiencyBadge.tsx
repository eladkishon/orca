import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import { ProjectUsageTrend } from './ProjectUsageTrend'
import type { ClaudeUsageProjectDailyPoint } from '../../../../shared/claude-usage-types'
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
  scope,
  worktreeCount,
  trend,
  prominent = false,
  className
}: {
  usage: AgentEfficiencyInput | undefined
  weeklyBillableTotal: number
  /** What the figure covers, so the popover can say so exactly. */
  scope: 'worktree' | 'project'
  /** For a project: how many worktrees it adds up. Naming it is what stops a
   *  project total reading as a second opinion that happens to agree with its
   *  only card. */
  worktreeCount?: number
  /** Daily billable tokens for this project, when there is a trend to draw. */
  trend?: readonly ClaudeUsageProjectDailyPoint[]
  /** Sits on the project banner rather than in a card's footer: the figure
   *  becomes the thing you read, not a footnote beside the name. */
  prominent?: boolean
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
            'inline-flex shrink-0 items-center transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
            prominent
              ? // Why opaque with a ring: this sits ON the project's own photo,
                // and a translucent chip over a photograph is unreadable at
                // exactly the moment the banner is doing its job.
                'gap-2 rounded-full bg-background/90 px-2 py-1 shadow-sm ring-1 ring-border/70 backdrop-blur-sm hover:bg-background'
              : 'gap-1.5 rounded-full bg-muted-foreground/10 px-1.5 py-0.5 hover:bg-muted-foreground/20',
            className
          )}
        >
          {/* Why the number is big and its label small: the figure is what you
              read at a glance, and the words are only there to say what it
              counts. The old chip gave both the same weight, so neither won. */}
          <span className="flex items-baseline gap-1">
            <span
              className={cn(
                'font-bold tabular-nums text-foreground',
                prominent ? 'text-[13px] leading-none' : 'text-[11px] leading-none'
              )}
            >
              {formatPercent(share.weeklyShare)}
            </span>
            <span
              className={cn(
                'font-medium tracking-wide text-muted-foreground uppercase',
                prominent ? 'text-[9px]' : 'text-[8px]'
              )}
            >
              {translate('dashboardPopout.efficiency.ofWeekLabel', 'of week')}
            </span>
          </span>
          {share.resentShare === null ? null : (
            <>
              <span aria-hidden className="h-3 w-px shrink-0 bg-border/80" />
              <span className="flex items-baseline gap-1">
                <span
                  className={cn(
                    'font-bold tabular-nums',
                    prominent ? 'text-[13px] leading-none' : 'text-[11px] leading-none',
                    // Why only this one is coloured: it is the only figure a
                    // change in how you work can move.
                    wasteful ? 'text-amber-600 dark:text-amber-400' : 'text-foreground/60'
                  )}
                >
                  {formatPercent(share.resentShare)}
                </span>
                <span
                  className={cn(
                    'font-medium tracking-wide text-muted-foreground uppercase',
                    prominent ? 'text-[9px]' : 'text-[8px]'
                  )}
                >
                  {translate('dashboardPopout.efficiency.resentLabel', 're-sent')}
                </span>
              </span>
            </>
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
            {/* Why spell out the subject: this counts every session that ran in
                the worktree over seven days, not the turn you are looking at,
                and the two are very different numbers. */}
            {scope === 'worktree'
              ? translate(
                  'dashboardPopout.efficiency.weekBodyWorktree',
                  'Everything billed in this worktree over the last 7 days — all of its sessions, not just this one — as a share of every project.'
                )
              : worktreeCount === 1
                ? translate(
                    'dashboardPopout.efficiency.weekBodyProjectOne',
                    'Everything billed in this project’s one active worktree over the last 7 days, as a share of every project — the same figure its card shows.'
                  )
                : translate(
                    'dashboardPopout.efficiency.weekBodyProjectMany',
                    'Everything billed across this project’s {{count}} active worktrees over the last 7 days, as a share of every project.',
                    { count: worktreeCount ?? 0 }
                  )}
          </p>
        </div>
        {trend && trend.length > 1 ? (
          <ProjectUsageTrend points={trend} className="border-t border-border/60 pt-2.5" />
        ) : null}
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
