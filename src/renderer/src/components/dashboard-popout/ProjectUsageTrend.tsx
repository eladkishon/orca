import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import type { ClaudeUsageProjectDailyPoint } from '../../../../shared/claude-usage-types'

/**
 * A project's billable tokens per day, drawn as bars.
 *
 * Bars rather than a line: these are discrete days with gaps in them, and a
 * line between two points a week apart draws a slope that never happened.
 * Heights are relative to the project's own busiest day — the question this
 * answers is "is this settling down or climbing", not "how does it compare to
 * the others", which the share figure above it already answers.
 */
export function ProjectUsageTrend({
  points,
  compact = false,
  className
}: {
  points: readonly ClaudeUsageProjectDailyPoint[]
  /** Inline on the column: bars only, no sentence — there is no room for one. */
  compact?: boolean
  className?: string
}): React.JSX.Element | null {
  // Why two: one bar is not a trend, and drawing it as one implies a shape.
  if (points.length < 2) {
    return null
  }
  const peak = Math.max(...points.map((point) => point.billableTokens))
  if (peak <= 0) {
    return null
  }
  const last = points.at(-1)
  const previous = points.at(-2)
  const direction =
    last && previous && previous.billableTokens > 0
      ? last.billableTokens / previous.billableTokens - 1
      : null

  const bars = (
    <div
      className={cn('flex items-end', compact ? 'gap-px' : 'gap-0.5')}
      style={{ height: compact ? 14 : 32 }}
      title={
        compact
          ? translate('dashboardPopout.efficiency.trendTitle', 'Daily spend over the window')
          : undefined
      }
    >
      {points.map((point) => (
        <div
          key={point.day}
          title={point.day}
          className={cn(
            'min-w-0 rounded-t-[1px] bg-foreground/25',
            compact ? 'w-[3px]' : 'flex-1 rounded-t-[2px]'
          )}
          style={{
            // Why a floor: a day with real usage that rounds to nothing looks
            // like a day with none, and those are different facts.
            height: `${Math.max(point.billableTokens > 0 ? 8 : 0, (point.billableTokens / peak) * 100)}%`
          }}
        />
      ))}
    </div>
  )
  if (compact) {
    return bars
  }
  return (
    <div className={cn('space-y-1', className)}>
      {bars}
      <p className="text-[10px] text-muted-foreground">
        {direction === null
          ? translate('dashboardPopout.efficiency.trendFlat', 'Daily spend over the window.')
          : direction >= 0.1
            ? translate(
                'dashboardPopout.efficiency.trendUp',
                'Up {{percent}}% on the day before.',
                {
                  percent: Math.round(direction * 100)
                }
              )
            : direction <= -0.1
              ? translate(
                  'dashboardPopout.efficiency.trendDown',
                  'Down {{percent}}% on the day before.',
                  { percent: Math.round(Math.abs(direction) * 100) }
                )
              : translate('dashboardPopout.efficiency.trendSteady', 'Steady on the day before.')}
      </p>
    </div>
  )
}
