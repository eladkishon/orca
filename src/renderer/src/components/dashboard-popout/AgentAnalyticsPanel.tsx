import { useEffect, useMemo } from 'react'
import { useAppStore } from '@/store'
import { agentEfficiency, formatTokenCount } from '../../../../shared/agent-efficiency'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'

/**
 * Where the time and tokens are going, per project and per session.
 *
 * Built entirely from the usage scan Orca already runs — nothing here estimates
 * or samples. Where a signal is not measured it is absent rather than guessed,
 * because a number nobody can trace is worse than a gap.
 */

const GRADE_STYLES = {
  efficient: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
  mixed: 'bg-amber-500/12 text-amber-700 dark:text-amber-300',
  costly: 'bg-destructive/12 text-destructive',
  unknown: 'bg-muted-foreground/12 text-muted-foreground'
} as const

const GRADE_LABELS = {
  efficient: () => translate('dashboardPopout.analytics.grade.efficient', 'Efficient'),
  mixed: () => translate('dashboardPopout.analytics.grade.mixed', 'Could be leaner'),
  costly: () => translate('dashboardPopout.analytics.grade.costly', 'Expensive'),
  unknown: () => translate('dashboardPopout.analytics.grade.unknown', 'No data')
} as const

function GradePill({ grade }: { grade: keyof typeof GRADE_STYLES }): React.JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
        GRADE_STYLES[grade]
      )}
    >
      {GRADE_LABELS[grade]()}
    </span>
  )
}

function Row({
  label,
  sublabel,
  usage
}: {
  label: string
  sublabel?: string
  usage: Parameters<typeof agentEfficiency>[0]
}): React.JSX.Element {
  const efficiency = agentEfficiency(usage)
  return (
    <li className="flex flex-col gap-1 rounded-lg border border-border/50 bg-background/50 p-2.5">
      <div className="flex items-center gap-2">
        <span className="truncate text-[13px] font-semibold text-foreground">{label}</span>
        <GradePill grade={efficiency.grade} />
        <span className="ml-auto shrink-0 text-[11px] tabular-nums text-muted-foreground">
          {formatTokenCount(efficiency.totalTokens)}
        </span>
      </div>
      {sublabel ? (
        <span className="truncate text-[10.5px] text-muted-foreground/80">{sublabel}</span>
      ) : null}
      <p className="text-[11px] leading-[1.5] text-foreground/80">{efficiency.headline}</p>
      <dl className="flex flex-wrap gap-x-4 gap-y-0.5 text-[10.5px] text-muted-foreground">
        <div className="flex gap-1">
          <dt>{translate('dashboardPopout.analytics.reuse', 'Context reused')}</dt>
          <dd className="tabular-nums text-foreground/70">
            {efficiency.cacheReuseRate === null
              ? '—'
              : `${Math.round(efficiency.cacheReuseRate * 100)}%`}
          </dd>
        </div>
        <div className="flex gap-1">
          <dt>{translate('dashboardPopout.analytics.perStep', 'Per step')}</dt>
          <dd className="tabular-nums text-foreground/70">
            {efficiency.tokensPerTurn === null ? '—' : formatTokenCount(efficiency.tokensPerTurn)}
          </dd>
        </div>
        <div className="flex gap-1">
          <dt>{translate('dashboardPopout.analytics.steps', 'Steps')}</dt>
          <dd className="tabular-nums text-foreground/70">{usage.turns || '—'}</dd>
        </div>
      </dl>
    </li>
  )
}

export function AgentAnalyticsPanel(): React.JSX.Element {
  const projectBreakdown = useAppStore((state) => state.claudeUsageProjectBreakdown)
  const recentSessions = useAppStore((state) => state.claudeUsageRecentSessions)
  const scanState = useAppStore((state) => state.claudeUsageScanState)
  const fetchClaudeUsage = useAppStore((state) => state.fetchClaudeUsage)

  // Why on open rather than on a timer: the scan reads local history files, so
  // it is worth paying for when someone is looking and not otherwise.
  useEffect(() => {
    void fetchClaudeUsage()
  }, [fetchClaudeUsage])

  const sessions = useMemo(
    () =>
      [...(recentSessions ?? [])]
        .sort(
          (first, second) =>
            second.inputTokens +
            second.cacheReadTokens -
            (first.inputTokens + first.cacheReadTokens)
        )
        .slice(0, 12),
    [recentSessions]
  )

  // Why "nothing to show" rather than empty tables: a table of zero rows reads
  // as "these agents used nothing", which is a claim. Not having scanned is a
  // different statement and the panel has to make the right one.
  const hasRows = (projectBreakdown?.length ?? 0) > 0 || sessions.length > 0
  if (!hasRows || scanState?.hasAnyClaudeData === false) {
    return (
      <p className="p-4 text-[12px] text-muted-foreground">
        {translate(
          'dashboardPopout.analytics.empty',
          'No usage data yet. Orca reads it from your local Claude history; enable usage scanning in Settings → Usage.'
        )}
      </p>
    )
  }

  return (
    <div className="scrollbar-sleek flex flex-col gap-4 overflow-y-auto p-3">
      <section className="flex flex-col gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
          {translate('dashboardPopout.analytics.byProject', 'By project')}
        </h3>
        <ul className="flex flex-col gap-2">
          {(projectBreakdown ?? []).slice(0, 12).map((row) => (
            <Row key={row.key} label={row.label} usage={row} />
          ))}
        </ul>
      </section>
      <section className="flex flex-col gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
          {translate('dashboardPopout.analytics.bySession', 'By session')}
        </h3>
        <ul className="flex flex-col gap-2">
          {sessions.map((row) => (
            <Row
              key={row.sessionId}
              label={row.projectLabel}
              sublabel={[row.branch, row.model, `${Math.round(row.durationMinutes)}m`]
                .filter(Boolean)
                .join(' · ')}
              usage={row}
            />
          ))}
        </ul>
      </section>
    </div>
  )
}
