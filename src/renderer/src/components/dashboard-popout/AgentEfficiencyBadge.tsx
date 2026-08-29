import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { buildUsageFixPrompt, diagnoseUsage } from '../../../../shared/agent-usage-diagnosis'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import { ProjectUsageTrend } from './ProjectUsageTrend'
import type { ClaudeUsageProjectDailyPoint } from '../../../../shared/claude-usage-types'
import {
  agentUsageShare,
  formatCostUsd,
  formatPercent,
  formatTokenCount,
  type AgentEfficiencyInput
} from '../../../../shared/agent-efficiency'

/**
 * One number on the chip: this subject's share of all recorded SPEND. Where
 * that spend went is the distribution bar's job inside the popover.
 *
 * The chip shows a share of dollars, not of tokens. Cache reads bill at a tenth
 * of input and run a hundred times larger, so a token share and a cost share
 * disagree wildly — and only one of them is the bill.
 */
/** The span every share on the board is measured against — the totals to divide
 *  by and the day it reaches back to. One object because they are only ever
 *  meaningful together: a percentage of an unnamed window says nothing. */
export type UsageWindow = {
  /** All recorded spend. Null where the host priced nothing, which is the only
   *  case where the board falls back to dividing token counts. */
  totalCostUsd: number | null
  totalTokens: number
  /** Earliest day the scan has data for (YYYY-MM-DD), when it has any. */
  sinceDay?: string | undefined
}

export function AgentEfficiencyBadge({
  usage,
  window: usageWindow,
  scope,
  scopeLabel,
  onFix,
  worktreeCount,
  trend,
  prominent = false,
  className
}: {
  usage: AgentEfficiencyInput | undefined
  window: UsageWindow | undefined
  /** Names the subject in the prompt handed to the agent. */
  scopeLabel: string
  /** Starts an agent on the drafted prompt. Absent where nothing can launch. */
  onFix?: ((prompt: string) => void) | undefined
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
  const share = agentUsageShare(usage, {
    costUsd: usageWindow?.totalCostUsd ?? null,
    tokens: usageWindow?.totalTokens ?? 0
  })
  // Why parsed as local noon: a bare YYYY-MM-DD is parsed as UTC midnight, which
  // renders as the day before for anyone west of Greenwich.
  const sinceLabel = usageWindow?.sinceDay
    ? new Date(`${usageWindow.sinceDay}T12:00:00`).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })
    : null
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
              {formatPercent(share.spendShare)}
            </span>
            <span
              className={cn(
                'font-medium tracking-wide text-muted-foreground uppercase',
                prominent ? 'text-[9px]' : 'text-[8px]'
              )}
            >
              {translate('dashboardPopout.efficiency.ofSpendLabel', 'of spend')}
            </span>
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={6} className="w-72 space-y-2.5 p-3">
        <div className="space-y-1">
          <p className="text-[12px] font-semibold text-foreground">
            {sinceLabel
              ? translate(
                  'dashboardPopout.efficiency.totalTitleSince',
                  '{{percent}} of all usage since {{since}}',
                  { percent: formatPercent(share.spendShare), since: sinceLabel }
                )
              : translate('dashboardPopout.efficiency.totalTitle', '{{percent}} of all usage', {
                  percent: formatPercent(share.spendShare)
                })}
          </p>
          <p className="text-[11px] leading-[1.5] text-muted-foreground">
            {/* Why spell out the subject: this counts every session the scan has
                on record for the worktree, not the turn you are looking at, and
                the two are very different numbers. */}
            {scope === 'worktree'
              ? translate(
                  'dashboardPopout.efficiency.totalBodyWorktree',
                  'Everything ever billed in this worktree — all of its sessions, not just this one — as a share of every project.'
                )
              : worktreeCount === 1
                ? translate(
                    'dashboardPopout.efficiency.totalBodyProjectOne',
                    'Everything ever billed in this project’s one worktree, as a share of every project.'
                  )
                : translate(
                    'dashboardPopout.efficiency.totalBodyProjectMany',
                    'Everything ever billed across this project’s {{count}} worktrees, as a share of every project.',
                    { count: worktreeCount ?? 0 }
                  )}
          </p>
        </div>
        {trend && trend.length > 1 ? (
          <ProjectUsageTrend points={trend} className="border-t border-border/60 pt-2.5" />
        ) : null}
        <dl className="space-y-1 border-t border-border/60 pt-2.5">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-[11px] text-muted-foreground">
              {translate('dashboardPopout.efficiency.spent', 'Spent')}
            </dt>
            <dd className="text-[11px] font-medium tabular-nums text-foreground">
              {share.estimatedCostUsd === null
                ? formatTokenCount(share.totalTokens)
                : `${formatCostUsd(share.estimatedCostUsd)} · ${formatTokenCount(share.totalTokens)}`}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-[11px] text-muted-foreground">
              {translate('dashboardPopout.efficiency.turns', 'Turns')}
            </dt>
            <dd className="text-[11px] font-medium tabular-nums text-foreground">
              {usage.turns.toLocaleString()}
            </dd>
          </div>
          {share.contextPerTurn === null ? null : (
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-[11px] text-muted-foreground">
                {translate('dashboardPopout.efficiency.contextPerTurn', 'Context each turn')}
              </dt>
              <dd
                className={cn(
                  'text-[11px] font-medium tabular-nums',
                  // Past the threshold the rate doubles, so this is the one
                  // figure here worth colouring.
                  share.overLongContextThreshold
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-foreground'
                )}
              >
                {formatTokenCount(Math.round(share.contextPerTurn))}
              </dd>
            </div>
          )}
        </dl>
        <TokenDistribution usage={usage} />
        <UsageAdvice
          usage={usage}
          scopeLabel={scopeLabel}
          sinceDay={usageWindow?.sinceDay}
          onFix={onFix}
        />
      </PopoverContent>
    </Popover>
  )
}

/**
 * Where the money went, as one stacked bar.
 *
 * Priced, not counted. An earlier version of this drew token counts and had to
 * drop cache reads to stay legible, because they are ~98% of the tokens. On the
 * bill they are ~78% — still the largest slice, but now the other three are
 * visible beside it and the picture is the true one. A chart of tokens was
 * describing a bill nobody pays.
 */
function TokenDistribution({ usage }: { usage: AgentEfficiencyInput }): React.JSX.Element | null {
  const cost = usage.costUsd
  if (!cost) {
    return null
  }
  const segments = [
    {
      key: 'cacheRead',
      amount: cost.cacheRead,
      label: translate('dashboardPopout.efficiency.distCacheRead', 'Context re-read'),
      color: 'bg-emerald-500/80'
    },
    {
      key: 'cacheWrite',
      amount: cost.cacheWrite,
      label: translate('dashboardPopout.efficiency.distCacheWrite', 'Context cached'),
      color: 'bg-violet-500/80'
    },
    {
      key: 'output',
      amount: cost.output,
      label: translate('dashboardPopout.efficiency.distOutput', 'Output'),
      color: 'bg-sky-500/80'
    },
    {
      key: 'input',
      amount: cost.input,
      label: translate('dashboardPopout.efficiency.distInput', 'Uncached input'),
      color: 'bg-amber-500/80'
    }
  ] as const
  const total = segments.reduce((sum, segment) => sum + segment.amount, 0)
  if (total <= 0) {
    return null
  }
  return (
    <div className="space-y-1.5 border-t border-border/60 pt-2.5">
      <p className="text-[11px] font-semibold text-foreground">
        {translate('dashboardPopout.efficiency.distTitle', 'Where the money went')}
      </p>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted-foreground/10">
        {segments
          .filter((segment) => segment.amount > 0)
          .map((segment) => (
            <div
              key={segment.key}
              title={`${segment.label}: ${formatCostUsd(segment.amount)}`}
              className={cn(segment.color)}
              style={{ width: `${(segment.amount / total) * 100}%` }}
            />
          ))}
      </div>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-0.5">
        {segments.map((segment) => (
          <li
            key={segment.key}
            className="flex items-center gap-1 text-[10px] text-muted-foreground"
          >
            <span aria-hidden className={cn('h-1.5 w-1.5 shrink-0 rounded-full', segment.color)} />
            <span className="truncate">{segment.label}</span>
            <span className="ml-auto shrink-0 tabular-nums">
              {formatPercent(segment.amount / total)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * The one thing worth doing about the split above, and a way to start doing it.
 *
 * The button drafts the prompt into a new agent rather than sending it: a chip
 * on a dashboard is not enough authority to start a billed turn, and the reader
 * is the one who knows whether the repo is worth the time.
 */
function UsageAdvice({
  usage,
  scopeLabel,
  sinceDay,
  onFix
}: {
  usage: AgentEfficiencyInput
  scopeLabel: string
  sinceDay: string | undefined
  onFix: ((prompt: string) => void) | undefined
}): React.JSX.Element | null {
  const diagnosis = diagnoseUsage(usage)
  const contextLabel =
    diagnosis.contextPerTurn === null ? '—' : formatTokenCount(Math.round(diagnosis.contextPerTurn))
  const advice = {
    'over-threshold': {
      headline: translate(
        'dashboardPopout.efficiency.adviceThresholdTitle',
        '{{context}} of context on every turn — over the double-rate line',
        { context: contextLabel }
      ),
      body: translate(
        'dashboardPopout.efficiency.adviceThresholdBody',
        'Past 200k, cache reads bill at twice the rate, so every turn pays double for the whole context. Getting under it is worth more than any other change here.'
      )
    },
    'heavy-context': {
      headline: translate(
        'dashboardPopout.efficiency.adviceHeavyTitle',
        '{{context}} of context rides along on every turn',
        { context: contextLabel }
      ),
      body: translate(
        'dashboardPopout.efficiency.adviceHeavyBody',
        'Skills, tool definitions and instruction files are re-read and re-billed each turn whether or not they are used. Trimming them is multiplied by the turn count.'
      )
    },
    healthy: {
      headline: translate('dashboardPopout.efficiency.adviceHealthyTitle', 'Nothing to fix here'),
      body: translate(
        'dashboardPopout.efficiency.adviceHealthyBody',
        'The context carried into each turn is modest, so there is little to win by trimming it.'
      )
    }
  }[diagnosis.id]
  return (
    <div className="space-y-1.5 border-t border-border/60 pt-2.5">
      <p className="text-[11px] font-semibold text-foreground">{advice.headline}</p>
      <p className="text-[10px] leading-[1.5] text-muted-foreground">{advice.body}</p>
      {onFix ? (
        <Button
          type="button"
          size="sm"
          variant={diagnosis.id === 'healthy' ? 'outline' : 'default'}
          className="h-6 w-full text-[10px]"
          onClick={() => onFix(buildUsageFixPrompt({ diagnosis, usage, scopeLabel, sinceDay }))}
        >
          {diagnosis.id === 'healthy'
            ? translate('dashboardPopout.efficiency.adviceReview', 'Audit context anyway')
            : translate('dashboardPopout.efficiency.adviceFix', 'Find what’s in the context')}
        </Button>
      ) : null}
    </div>
  )
}
