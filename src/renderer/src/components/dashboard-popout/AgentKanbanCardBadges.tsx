import { GitMerge, GitPullRequest, GitPullRequestClosed, GitPullRequestDraft } from 'lucide-react'
import { LinearIcon } from '@/components/icons/LinearIcon'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import type { DashboardCard } from '../../../../shared/dashboard-snapshot'

const REVIEW_PRESENTATION = {
  open: {
    icon: GitPullRequest,
    className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
  },
  draft: {
    icon: GitPullRequestDraft,
    className: 'border-border bg-muted/60 text-muted-foreground'
  },
  merged: {
    icon: GitMerge,
    className: 'border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300'
  },
  closed: {
    icon: GitPullRequestClosed,
    className: 'border-destructive/30 bg-destructive/10 text-destructive'
  }
} as const

const CHECKS_PRESENTATION = {
  pending: { className: 'bg-amber-500 animate-pulse', label: 'CI running' },
  success: { className: 'bg-emerald-500', label: 'CI passing' },
  failure: { className: 'bg-destructive', label: 'CI failing' },
  neutral: { className: 'bg-muted-foreground/50', label: 'CI neutral' }
} as const

type ReviewState = NonNullable<DashboardCard['review']>['state']

function reviewTitle(state: ReviewState): string {
  switch (state) {
    case 'open':
      return translate('dashboardPopout.card.review.open', 'Open review')
    case 'draft':
      return translate('dashboardPopout.card.review.draft', 'Draft review')
    case 'merged':
      return translate('dashboardPopout.card.review.merged', 'Merged review')
    default:
      return translate('dashboardPopout.card.review.closed', 'Closed review')
  }
}

/** The pop-out hosts no browser pane, so external links go to the system browser. */
function openExternal(url: string): void {
  void window.api.shell.openUrl(url).catch(() => undefined)
}

const BADGE_BASE =
  'inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] leading-none font-medium tabular-nums'

function ReviewBadge({ card }: { card: DashboardCard }): React.JSX.Element | null {
  const review = card.review
  if (!review) {
    return null
  }
  const url = review.url
  const presentation = REVIEW_PRESENTATION[review.state]
  const Icon = presentation.icon
  const checks = review.checksStatus ? CHECKS_PRESENTATION[review.checksStatus] : null
  const title = reviewTitle(review.state)
  const label = `${title} #${review.number}${checks ? ` — ${checks.label}` : ''}`
  const content = (
    <>
      <Icon className="size-3" aria-hidden />#{review.number}
      {checks ? (
        <span className={cn('size-1.5 rounded-full', checks.className)} aria-hidden />
      ) : null}
    </>
  )
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {url ? (
          <button
            type="button"
            aria-label={label}
            onClick={(event) => {
              event.stopPropagation()
              openExternal(url)
            }}
            className={cn(BADGE_BASE, presentation.className, 'hover:brightness-110')}
          >
            {content}
          </button>
        ) : (
          <span role="img" aria-label={label} className={cn(BADGE_BASE, presentation.className)}>
            {content}
          </span>
        )}
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

function LinearBadge({ card }: { card: DashboardCard }): React.JSX.Element | null {
  const issue = card.linearIssue
  if (!issue) {
    return null
  }
  const url = issue.url
  const content = (
    <>
      <LinearIcon className="size-3" aria-hidden />
      {issue.identifier}
    </>
  )
  const className = cn(BADGE_BASE, 'border-border bg-muted/60 text-muted-foreground')
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {url ? (
          <button
            type="button"
            aria-label={issue.identifier}
            onClick={(event) => {
              event.stopPropagation()
              openExternal(url)
            }}
            className={cn(className, 'hover:text-foreground')}
          >
            {content}
          </button>
        ) : (
          <span role="img" aria-label={issue.identifier} className={className}>
            {content}
          </span>
        )}
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4}>
        {issue.identifier}
      </TooltipContent>
    </Tooltip>
  )
}

/**
 * The card's top-right corner: the review and its CI, then the linked ticket.
 * Lives outside the card's open-terminal button — these are their own links,
 * and a button cannot nest inside a button.
 */
export function AgentKanbanCardBadges({ card }: { card: DashboardCard }): React.JSX.Element | null {
  if (!card.review && !card.linearIssue) {
    return null
  }
  return (
    <div className="flex items-center gap-1">
      <ReviewBadge card={card} />
      <LinearBadge card={card} />
    </div>
  )
}
