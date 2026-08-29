import { RepoIconGlyph } from '@/components/repo/repo-icon'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import { AgentKanbanCard } from './AgentKanbanCard'
import { AgentEfficiencyBadge } from './AgentEfficiencyBadge'
import { ProjectHeaderActions } from './ProjectHeaderActions'
import { ProjectUsageTrend } from './ProjectUsageTrend'
import { PendingSpawnCard } from './PendingSpawnCard'
import type { PendingCardAction, PendingSpawn } from './board-pending-actions'
import { translate } from '@/i18n/i18n'
import type { TuiAgent } from '../../../../shared/tui-agent'
import type { ClaudeUsageProjectDailyPoint } from '../../../../shared/claude-usage-types'
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
  repoPath,
  usageByWorktree,
  weeklyBillableTotal,
  stallAfterMs,
  launchableAgents,
  onSetBanner,
  onSpawnAgent,
  onEndSession,
  pendingByPaneKey,
  pendingSpawns,
  projectTrend,
  now,
  onOpenTerminal,
  onRemoveWorkspace,
  density,
  orientation
}: {
  group: DashboardColumnGroup
  repoIcon: RepoIcon | null
  banner: RepoBanner | undefined
  repoPath: string | undefined
  usageByWorktree: Map<string, AgentEfficiencyInput>
  weeklyBillableTotal: number
  /** The board's stall threshold, applied to every card in the column. */
  stallAfterMs?: number
  launchableAgents: { worktreeId: string; agents: readonly TuiAgent[] } | null
  onSetBanner: (repoId: string, banner: RepoBanner | null) => void
  onSpawnAgent: (worktreeId: string, agent: TuiAgent) => void
  onEndSession: (card: DashboardCard) => void
  /** Cards whose removal or end has been asked for but not yet confirmed by a
   *  snapshot — drawn as leaving rather than waiting for the round trip. */
  pendingByPaneKey: ReadonlyMap<string, PendingCardAction>
  pendingSpawns: readonly PendingSpawn[] | undefined
  projectTrend: readonly ClaudeUsageProjectDailyPoint[] | undefined
  now: number
  onOpenTerminal: (card: DashboardCard) => void
  onRemoveWorkspace: (card: DashboardCard) => void
  density: DashboardCardDensity
  orientation: DashboardBoardOrientation
}): React.JSX.Element {
  const bannerVariant =
    banner?.kind === 'generated' ? banner.variant : defaultRepoBannerVariant(group.projectId)
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
      <header className="project-banner group/project relative flex flex-col gap-1.5 overflow-hidden rounded-t-xl px-3 py-2.5">
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
            data-banner={bannerVariant}
            className="repo-banner pointer-events-none absolute inset-0"
          />
        )}
        <div className="relative flex items-center gap-2">
          <span className="project-accent inline-flex size-4 shrink-0 items-center justify-center">
            <RepoIconGlyph repoIcon={repoIcon} className="size-4" iconClassName="size-4" />
          </span>
          <span
            className={cn(
              'project-accent truncate text-[17px] leading-tight font-extrabold tracking-[-0.02em]',
              // Why: over an image the hue loses its background to sit against,
              // so the title goes to the theme's own foreground where contrast is
              // guaranteed by the scrim behind it.
              banner && 'text-foreground'
            )}
          >
            {group.projectName}
          </span>
          <ProjectHeaderActions
            projectId={group.projectId}
            repoPath={repoPath}
            projectHue={projectAccentHue(group.projectId)}
            activeVariant={bannerVariant}
            launchableAgents={launchableAgents}
            onSetBanner={onSetBanner}
            onSpawnAgent={onSpawnAgent}
            className="ml-auto"
          />
        </div>
        {/* Why on the banner rather than under it: the figure is about the
            project, so it belongs in the block that names the project. Below,
            it read as a caption on the column's first card. */}
        {projectUsage ? (
          <div className="relative flex items-center gap-1.5">
            {projectTrend && projectTrend.length > 1 ? (
              <ProjectUsageTrend points={projectTrend} compact />
            ) : null}
            <AgentEfficiencyBadge
              weeklyBillableTotal={weeklyBillableTotal}
              usage={projectUsage.usage}
              scope="project"
              worktreeCount={projectUsage.worktreeCount}
              trend={projectTrend}
              prominent
            />
          </div>
        ) : null}
      </header>
      <div
        className={cn(
          // Why the padding: cards sat flush against the project box, so a card
          // read as part of the container's edge rather than as a thing inside
          // it. The gutter is what makes the grouping visible.
          'gap-2.5 p-2.5',
          orientation === 'rows'
            ? // A band per project: its agents share the width evenly rather
              // than each shrinking to its own content.
              cn(
                'scrollbar-sleek grid overflow-x-auto',
                density === 'detailed'
                  ? 'grid-cols-[repeat(auto-fit,minmax(min(100%,360px),1fr))]'
                  : 'grid-cols-[repeat(auto-fit,minmax(min(100%,264px),1fr))]'
              )
            : 'scrollbar-sleek flex min-h-0 flex-1 flex-col overflow-y-auto'
        )}
      >
        {group.cards.map((card) => {
          const pending = pendingByPaneKey.get(card.paneKey)
          return (
            <div key={card.paneKey} className={cn('relative', pending && 'opacity-45')}>
              <AgentKanbanCard
                card={card}
                now={now}
                onOpenTerminal={onOpenTerminal}
                onRemoveWorkspace={onRemoveWorkspace}
                onEndSession={onEndSession}
                density={density}
                usage={usageByWorktree.get(card.worktreeId)}
                weeklyBillableTotal={weeklyBillableTotal}
                stallAfterMs={stallAfterMs}
              />
              {/* Why an overlay and not a badge inside the card: the card must
                  stop responding while it is on its way out, and the label has
                  to say which of the two things was asked for. */}
              {pending ? (
                <div
                  className="absolute inset-0 flex items-center justify-center gap-1.5 rounded-lg bg-background/60 text-[11px] font-medium text-foreground"
                  aria-live="polite"
                >
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  {pending.kind === 'removing'
                    ? translate('dashboardPopout.card.removing', 'Removing…')
                    : translate('dashboardPopout.card.ending', 'Ending…')}
                </div>
              ) : null}
            </div>
          )
        })}
        {pendingSpawns?.map((spawn) => (
          <PendingSpawnCard key={spawn.id} spawn={spawn} />
        ))}
      </div>
    </section>
  )
}
