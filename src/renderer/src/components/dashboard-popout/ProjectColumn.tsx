import { RepoIconGlyph } from '@/components/repo/repo-icon'
import { cn } from '@/lib/utils'
import { AgentKanbanCard } from './AgentKanbanCard'
import { AgentEfficiencyBadge } from './AgentEfficiencyBadge'
import { projectAccentHue } from './project-accent-hue'
import { defaultRepoBannerVariant, type RepoBanner } from '../../../../shared/repo-banner'
import { sumWorktreeUsage } from '../../../../shared/usage-by-worktree'
import type { AgentEfficiencyInput } from '../../../../shared/agent-efficiency'
import type { DashboardCard } from '../../../../shared/dashboard-snapshot'
import type { RepoIcon } from '../../../../shared/repo-icon'
import type { DashboardColumnGroup } from './dashboard-column-groups'
import type { DashboardCardDensity } from './dashboard-card-density'
import type { DashboardBoardOrientation } from './dashboard-board-orientation'
import './agent-card-state.css'

/**
 * One project, its agents beneath it.
 *
 * The board used to be a column per state. It no longer is: the card's ring
 * says needs-you / working / stalled / done and its badge says what kind of
 * work that is, so a column spent on state was a heading repeating what every
 * card already showed. Projects are what a column is actually for — you work
 * on one repo at a time, and the agents on it belong together.
 */
export function ProjectColumn({
  group,
  repoIcon,
  banner,
  usageByWorktree,
  weeklyBillableTotal,
  now,
  onOpenTerminal,
  onRemoveWorkspace,
  density,
  orientation
}: {
  group: DashboardColumnGroup
  repoIcon: RepoIcon | null
  banner: RepoBanner | undefined
  usageByWorktree: Map<string, AgentEfficiencyInput>
  weeklyBillableTotal: number
  now: number
  onOpenTerminal: (card: DashboardCard) => void
  onRemoveWorkspace: (card: DashboardCard) => void
  density: DashboardCardDensity
  orientation: DashboardBoardOrientation
}): React.JSX.Element {
  const projectUsage = sumWorktreeUsage(
    usageByWorktree,
    group.cards.map((card) => card.worktreeId)
  )
  return (
    <section
      className={cn(
        'flex flex-col rounded-xl border border-border/60 bg-muted/30',
        orientation === 'rows'
          ? 'w-full min-w-0 shrink-0'
          : cn('flex-1', density === 'detailed' ? 'min-w-[360px]' : 'min-w-[264px]')
      )}
      style={{ '--project-hue': projectAccentHue(group.projectId) } as React.CSSProperties}
    >
      <header className="project-banner relative flex items-center gap-2 overflow-hidden rounded-t-xl px-3 py-2.5">
        {/* Why: the image sits behind the heading rather than above it, so a
            project is recognisable without costing a row of board height. The
            scrim is not decoration — a photograph behind text is the fastest
            way to make a heading unreadable, and the hue wash is a colour the
            user never chose to sit under their own image. */}
        {banner?.kind === 'image' ? (
          <>
            <img
              src={banner.src}
              alt=""
              aria-hidden
              className="pointer-events-none absolute inset-0 size-full object-cover"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-gradient-to-r from-background/92 via-background/75 to-background/40"
            />
          </>
        ) : (
          // Why a generated banner rather than nothing: a board where every
          // column looks alike is the problem the banner exists to solve, and
          // finding a picture that reads as "this project" is work nobody
          // should have to do before their columns are distinguishable.
          <span
            aria-hidden
            data-banner={banner?.variant ?? defaultRepoBannerVariant(group.projectId)}
            className="repo-banner pointer-events-none absolute inset-0"
          />
        )}
        <span className="project-accent relative inline-flex size-4 shrink-0 items-center justify-center">
          <RepoIconGlyph repoIcon={repoIcon} className="size-4" iconClassName="size-4" />
        </span>
        <span
          className={cn(
            'project-accent relative truncate text-[17px] leading-tight font-extrabold tracking-[-0.02em]',
            // Why: over an image the hue loses its background to sit against,
            // so the title goes to the theme's own foreground where contrast is
            // guaranteed by the scrim behind it.
            banner && 'text-foreground'
          )}
        >
          {group.projectName}
        </span>
        {/* Why on the heading: a project's spend is the sum of its agents', and
            this is the row where a project is read as one thing. */}
        {/* Why suppress a single-worktree total: it is that worktree's own
            figure with a different label on it, and showing both invites the
            reader to believe two independent measurements agree. */}
        {projectUsage && projectUsage.worktreeCount > 1 ? (
          <AgentEfficiencyBadge
            className="relative ml-auto"
            weeklyBillableTotal={weeklyBillableTotal}
            usage={projectUsage.usage}
            scope="project"
          />
        ) : null}
        <span className="relative ml-auto shrink-0 rounded-full bg-background px-1.5 text-[11px] tabular-nums text-muted-foreground">
          {group.cards.length}
        </span>
      </header>
      <div
        className={cn(
          'flex gap-2 px-2 pb-2',
          orientation === 'rows'
            ? // A band per project: its agents run across it as a grid.
              'scrollbar-sleek flex-row flex-wrap overflow-x-auto'
            : 'scrollbar-sleek min-h-0 flex-1 flex-col overflow-y-auto'
        )}
      >
        {group.cards.map((card) => (
          <AgentKanbanCard
            key={card.paneKey}
            card={card}
            now={now}
            onOpenTerminal={onOpenTerminal}
            onRemoveWorkspace={onRemoveWorkspace}
            density={density}
            usage={usageByWorktree.get(card.worktreeId)}
            weeklyBillableTotal={weeklyBillableTotal}
          />
        ))}
      </div>
    </section>
  )
}
