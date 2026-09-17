import { RepoIconGlyph } from '@/components/repo/repo-icon'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { AgentKanbanCard } from './AgentKanbanCard'
import { AgentLiveSessionTile } from './AgentLiveSessionTile'
import { LiveSessionStack } from './LiveSessionStack'
import { AgentEfficiencyBadge, type UsageWindow } from './AgentEfficiencyBadge'
import { ProjectHeaderActions } from './ProjectHeaderActions'
import { WorktreeTitleInlineRename } from '@/components/sidebar/WorktreeTitleInlineRename'
import { ProjectUsageTrend } from './ProjectUsageTrend'
import { PendingSpawnCard } from './PendingSpawnCard'
import type { PendingCardAction, PendingSpawn } from './board-pending-actions'
import { translate } from '@/i18n/i18n'
import type { TuiAgent } from '../../../../shared/tui-agent'
import type { ClaudeUsageProjectDailyPoint } from '../../../../shared/claude-usage-types'
import { projectAccentHue } from './project-accent-hue'
import { defaultRepoBannerVariant, type RepoBanner } from '../../../../shared/repo-banner'
import {
  sumRepoUsage,
  sumWorktreeUsage,
  type WorktreeUsageRow
} from '../../../../shared/usage-by-worktree'
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
  usageRows,
  usageWindow,
  stallAfterMs,
  launchableAgents,
  onSetBanner,
  onRenameProject,
  onSpawnAgent,
  onCreateWorktree,
  onEndSession,
  pendingByPaneKey,
  pendingSpawns,
  projectTrend,
  now,
  onOpenTerminal,
  onRemoveWorkspace,
  density,
  orientation,
  collapsed = false,
  onToggleCollapse
}: {
  group: DashboardColumnGroup
  repoIcon: RepoIcon | null
  banner: RepoBanner | undefined
  repoPath: string | undefined
  usageByWorktree: Map<string, AgentEfficiencyInput>
  /** Every project row of the usage scan, so the header can total the repo. */
  usageRows: readonly WorktreeUsageRow[] | undefined
  usageWindow: UsageWindow
  /** The board's stall threshold, applied to every card in the column. */
  stallAfterMs?: number
  launchableAgents: { worktreeId: string; agents: readonly TuiAgent[] } | null
  onSetBanner: (repoId: string, banner: RepoBanner | null) => void
  onRenameProject: (projectId: string, name: string) => void
  onSpawnAgent: (worktreeId: string, agent: TuiAgent, prompt?: string) => void
  onCreateWorktree: (repoId: string) => void
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
  /** Folded to a spine: the project is still on the board, just not asking for
   *  any of its width. */
  collapsed?: boolean
  onToggleCollapse?: () => void
}): React.JSX.Element {
  if (collapsed) {
    return (
      <section className="flex h-full w-8 shrink-0 flex-col items-center gap-2 overflow-hidden rounded-xl border border-border/40 bg-muted/20 py-2 opacity-60 transition-opacity hover:opacity-100">
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={translate('dashboardPopout.project.expand', 'Expand project')}
          className="rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
        >
          <ChevronRight className="size-3.5" aria-hidden />
        </button>
        <span className="truncate text-[11px] font-semibold text-muted-foreground [writing-mode:vertical-rl]">
          {group.projectName}
        </span>
        <span className="mt-auto text-[10px] text-muted-foreground">{group.cards.length}</span>
      </section>
    )
  }
  const bannerVariant =
    banner?.kind === 'generated' ? banner.variant : defaultRepoBannerVariant(group.projectId)
  // Prefer the whole repo's usage; fall back to the carded worktrees only when
  // the rows carry no repoId (older host).
  const projectUsage =
    sumRepoUsage(usageRows, group.projectId) ??
    sumWorktreeUsage(
      usageByWorktree,
      group.cards.map((card) => card.worktreeId)
    )
  const cardTiles = [
    ...group.cards.map((card) => {
      const pending = pendingByPaneKey.get(card.paneKey)
      return (
        <div
          key={card.paneKey}
          className={cn(
            'relative',
            density === 'live' && 'h-full min-h-0',
            pending && 'opacity-45'
          )}
        >
          {density === 'live' ? (
            <AgentLiveSessionTile
              card={card}
              onOpenTerminal={onOpenTerminal}
              onEndSession={onEndSession}
            />
          ) : (
            <AgentKanbanCard
              card={card}
              now={now}
              onOpenTerminal={onOpenTerminal}
              onRemoveWorkspace={onRemoveWorkspace}
              onEndSession={onEndSession}
              density={density}
              usage={usageByWorktree.get(card.worktreeId)}
              usageWindow={usageWindow}
              stallAfterMs={stallAfterMs}
            />
          )}
          {/* Why an overlay and not a badge inside the card: the card must stop
              responding while it is on its way out, and the label has to say
              which of the two things was asked for. */}
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
    }),
    ...(pendingSpawns ?? []).map((spawn) => <PendingSpawnCard key={spawn.id} spawn={spawn} />)
  ]

  return (
    <section
      className={cn(
        'flex flex-col rounded-xl border border-border/60 bg-muted/30',
        orientation === 'rows'
          ? 'w-full min-w-0 shrink-0'
          : cn('flex-1', density === 'compact' ? 'min-w-[264px]' : 'min-w-[360px]'),
        // Live columns fill their share of the screen rather than their content.
        density === 'live' && 'min-h-0 flex-1'
      )}
      style={
        {
          '--project-hue': projectAccentHue(group.projectId)
        } as React.CSSProperties
      }
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
          {onToggleCollapse ? (
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label={translate('dashboardPopout.project.collapse', 'Collapse project')}
              className="-ml-1 shrink-0 rounded-sm p-0.5 text-muted-foreground opacity-0 transition-opacity group-hover/project:opacity-100 hover:text-foreground focus-visible:opacity-100"
            >
              <ChevronLeft className="size-3.5" aria-hidden />
            </button>
          ) : null}
          <span className="project-accent inline-flex size-4 shrink-0 items-center justify-center">
            <RepoIconGlyph repoIcon={repoIcon} className="size-4" iconClassName="size-4" />
          </span>
          {/* Why the wrapper: the accent colour is a plain class, so it is set
              here and inherited, rather than fighting the editor's own text-*. */}
          <span
            className={cn(
              'project-accent min-w-0',
              // Why: over an image the hue loses its background to sit against,
              // so the title goes to the theme's own foreground where contrast is
              // guaranteed by the scrim behind it.
              banner && 'text-foreground'
            )}
          >
            <WorktreeTitleInlineRename
              displayName={group.projectName}
              activateOn="click"
              editingPresentation="field"
              editorAriaLabel={translate('dashboardPopout.project.rename', 'Rename project')}
              className="truncate text-[17px] leading-tight font-extrabold tracking-[-0.02em] text-inherit"
              inputClassName="text-[17px] font-extrabold tracking-[-0.02em]"
              onRename={(name) => onRenameProject(group.projectId, name)}
            />
          </span>
          <ProjectHeaderActions
            projectId={group.projectId}
            repoPath={repoPath}
            projectHue={projectAccentHue(group.projectId)}
            activeVariant={bannerVariant}
            launchableAgents={launchableAgents}
            onSetBanner={onSetBanner}
            onSpawnAgent={onSpawnAgent}
            onCreateWorktree={onCreateWorktree}
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
              window={usageWindow}
              usage={projectUsage.usage}
              scope="project"
              scopeLabel={group.projectName}
              onFix={
                launchableAgents
                  ? (prompt) =>
                      onSpawnAgent(launchableAgents.worktreeId, launchableAgents.agents[0], prompt)
                  : undefined
              }
              worktreeCount={projectUsage.worktreeCount}
              trend={projectTrend}
              prominent
            />
          </div>
        ) : null}
      </header>
      {density === 'live' ? (
        // Live tiles keep a readable height and the column scrolls: sharing one
        // column's height between six sessions made every one of them useless,
        // and enlarging a tile must not shrink its neighbours.
        <LiveSessionStack className="scrollbar-sleek min-h-0 flex-1 overflow-y-auto p-2.5">
          {cardTiles}
        </LiveSessionStack>
      ) : (
        <div
          className={cn(
            // Why the padding: cards sat flush against the project box, so a
            // card read as part of the container's edge rather than as a thing
            // inside it. The gutter is what makes the grouping visible.
            'gap-2.5 p-2.5',
            orientation === 'rows'
              ? // A band per project: its agents share the width evenly rather
                // than each shrinking to its own content.
                cn(
                  'scrollbar-sleek grid overflow-x-auto',
                  density === 'compact'
                    ? 'grid-cols-[repeat(auto-fit,minmax(min(100%,264px),1fr))]'
                    : 'grid-cols-[repeat(auto-fit,minmax(min(100%,360px),1fr))]'
                )
              : 'scrollbar-sleek flex min-h-0 flex-1 flex-col overflow-y-auto'
          )}
        >
          {cardTiles}
        </div>
      )}
    </section>
  )
}
