import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChartNoAxesColumn, XIcon } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import type {
  DashboardCard,
  DashboardOpenFileArgs,
  DashboardSnapshot
} from '../../../../shared/dashboard-snapshot'
import type { RepoIcon } from '../../../../shared/repo-icon'
import type { RepoBanner } from '../../../../shared/repo-banner'
import { cn } from '@/lib/utils'
import { TooltipProvider } from '@/components/ui/tooltip'
import { installWindowVisibilityInterval } from '@/lib/window-visibility-interval'
import { AgentKanbanCard } from './AgentKanbanCard'
import { RepoIconGlyph } from '@/components/repo/repo-icon'
import { groupCardsByProject, type DashboardColumnGroup } from './dashboard-column-groups'
import { AgentDashboardToolbar } from './AgentDashboardToolbar'
import { AgentTerminalDialog, type AgentRevealArgs } from './AgentTerminalDialog'
import {
  EMPTY_DASHBOARD_FILTERS,
  filterDashboardCards,
  type DashboardFilters
} from './agent-board-filtering'
import './agent-board-transitions.css'
import type { DashboardCardDensity } from './dashboard-card-density'
import type { DashboardBoardOrientation } from './dashboard-board-orientation'
import { sortCardsByUrgency } from './dashboard-card-urgency'
import { AgentEfficiencyBadge } from './AgentEfficiencyBadge'
import { WeeklyBudgetBadge } from './WeeklyBudgetBadge'
import { useAppStore } from '@/store'
import { sumWorktreeUsage, usageByWorktreeId } from '../../../../shared/usage-by-worktree'
import type { AgentEfficiencyInput } from '../../../../shared/agent-efficiency'
import { projectAccentHue } from './project-accent-hue'
import './agent-card-state.css'
import { translate } from '@/i18n/i18n'

/** Ack an agent in the pop-out window: relayed over IPC to the main renderer.
 *  ?. shields dialog-opening from dev-HMR preload skew (renderer updates hot,
 *  the preload only on app restart) — acks just no-op until restart. */
function ackAgentViaPopoutRelay(paneKey: string): void {
  void window.api.dashboard.ackAgent?.(paneKey)
}

/** Reveal an agent from the pop-out window: raise the main window and route it
 *  to the agent's pane via IPC. Same `?.` HMR-skew guard as the ack relay —
 *  both channels ship together, so a stale preload lacks both. */
function revealAgentViaPopoutRelay(args: AgentRevealArgs): void {
  void window.api.dashboard.revealAgent?.(args)
}

/** Follow a preview file link from the pop-out window: the main renderer owns
 *  the workspace paths and the editor. Same `?.` HMR-skew guard as above. */
function openFileViaPopoutRelay(args: DashboardOpenFileArgs): void {
  void window.api.dashboard.openFile?.(args)
}

/** End an agent's session from the pop-out: the main renderer closes the tab,
 *  with the running-process confirm it already owns. */
function endSessionViaPopoutRelay(card: DashboardCard): void {
  void window.api.dashboard.closeSession?.({ tabId: card.tabId })
}

/** Remove a workspace from the pop-out: the main renderer runs the ordinary
 *  delete funnel, confirm included. Same `?.` HMR-skew guard as the relays above. */
function removeWorkspaceViaPopoutRelay(card: DashboardCard): void {
  void window.api.dashboard.removeWorkspace?.({
    worktreeId: card.worktreeId,
    ...(card.executionHostId ? { executionHostId: card.executionHostId } : {})
  })
}

/**
 * One project, its agents beneath it.
 *
 * The board used to be a column per state. It no longer is: the card's ring
 * says needs-you / working / stalled / done and its badge says what kind of
 * work that is, so a column spent on state was a heading repeating what every
 * card already showed. Projects are what a column is actually for — you work
 * on one repo at a time, and the agents on it belong together.
 */
function ProjectColumn({
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
        {banner ? (
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
        ) : null}
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
        <AgentEfficiencyBadge
          className="relative ml-auto"
          weeklyBillableTotal={weeklyBillableTotal}
          usage={sumWorktreeUsage(
            usageByWorktree,
            group.cards.map((card) => card.worktreeId)
          )}
        />
        <span className="relative shrink-0 rounded-full bg-background px-1.5 text-[11px] tabular-nums text-muted-foreground">
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

type AgentKanbanBoardProps = {
  snapshot: DashboardSnapshot
  /** Sizing for the outermost container. The pop-out fills the window
   *  (h-screen w-screen); the in-window drawer fills its host (h-full w-full). */
  containerClassName?: string
  /** Marks an agent as seen. Defaults to the pop-out IPC relay; the in-window
   *  host acks the store directly. */
  onAckAgent?: (paneKey: string) => void
  /** Focuses the agent's pane. Defaults to the pop-out IPC relay; the in-window
   *  host activates the worktree/pane locally and closes the overlay. */
  onRevealAgent?: (args: AgentRevealArgs) => void
  /** Follows a file link in a card's preview terminal. Defaults to the pop-out
   *  IPC relay; the in-window host opens the file locally. */
  onOpenFile?: (args: DashboardOpenFileArgs) => void
  /** Removes an idle card's worktree. Defaults to the pop-out IPC relay; the
   *  in-window host runs the delete funnel directly. */
  onRemoveWorkspace?: (card: DashboardCard) => void
  /** Ends an agent's session. Defaults to the pop-out IPC relay; the in-window
   *  host closes the tab directly. */
  onEndSession?: (card: DashboardCard) => void
  /** When provided, renders a close control in the header (in-window mode). The
   *  pop-out relies on its native window controls, so it omits this. */
  onClose?: () => void
  /** Header controls rendered before the close button. The in-window host
   *  passes its settings menu; the pop-out renderer has no store to drive it. */
  headerActions?: React.ReactNode
}

/** The agent board: status columns fed by a snapshot. Shared by the pop-out
 *  window and the in-window drawer — the two differ only in sizing and
 *  how ack/reveal are routed. */
export function AgentKanbanBoard({
  snapshot,
  containerClassName = 'h-screen w-screen',
  onAckAgent = ackAgentViaPopoutRelay,
  onRevealAgent = revealAgentViaPopoutRelay,
  onOpenFile = openFileViaPopoutRelay,
  onRemoveWorkspace = removeWorkspaceViaPopoutRelay,
  onEndSession = endSessionViaPopoutRelay,
  onClose,
  headerActions
}: AgentKanbanBoardProps): React.JSX.Element {
  // Why: idle is the one bucket a setting can hide, and it is the only reason
  // the board still filters by bucket at all now that states share a column.
  const visibleCards = useMemo(
    () =>
      snapshot.showIdle === true
        ? snapshot.cards
        : snapshot.cards.filter((card) => card.bucket !== 'idle'),
    [snapshot.cards, snapshot.showIdle]
  )
  const [query, setQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [filters, setFilters] = useState<DashboardFilters>(EMPTY_DASHBOARD_FILTERS)
  // Why: board-local like the filters beside it. Detail is a reading mode you
  // flip for the task in front of you, not a setting you configure once.
  const [density, setDensity] = useState<DashboardCardDensity>('compact')
  const [orientation, setOrientation] = useState<DashboardBoardOrientation>('columns')
  // Why a toggle and not a panel: the numbers belong on the things they
  // describe. A separate view made you hold a project's spend in your head
  // while looking at its column somewhere else.
  const [efficiencyShown, setEfficiencyShown] = useState(false)
  // Why in the board rather than each card: one index built per render beats
  // every card scanning the same row list for itself.
  const projectBreakdown = useAppStore((state) => state.claudeUsageProjectBreakdown)
  const usageByWorktree = useMemo(
    () => (efficiencyShown ? usageByWorktreeId(projectBreakdown) : new Map()),
    [efficiencyShown, projectBreakdown]
  )
  // Why every row and not just the board's: a project's share of the week has
  // to be measured against the whole week, including projects with no agent
  // running right now.
  const weeklyBillableTotal = useMemo(
    () =>
      (projectBreakdown ?? []).reduce(
        (total, row) => total + row.inputTokens + row.outputTokens + row.cacheWriteTokens,
        0
      ),
    [projectBreakdown]
  )
  const setClaudeUsageRange = useAppStore((state) => state.setClaudeUsageRange)
  const fetchClaudeUsage = useAppStore((state) => state.fetchClaudeUsage)
  // Why on demand: the scan reads local history files, so it is worth paying
  // for when someone asks to see the numbers and not otherwise.
  useEffect(() => {
    if (efficiencyShown) {
      // Why force the range: the shares read "of this week", so the window they
      // are drawn from has to be the week.
      void setClaudeUsageRange('7d')
      void fetchClaudeUsage()
    }
  }, [efficiencyShown, fetchClaudeUsage, setClaudeUsageRange])
  const filteredCards = useMemo(
    () => filterDashboardCards(visibleCards, query, filters),
    [visibleCards, filters, query]
  )
  // Why: the board is columns of PROJECTS now. State stopped needing a column
  // of its own once the card's ring and badge carried it; what the state
  // columns were really buying was order, which survives as a sort.
  const projectColumns = useMemo(
    () =>
      groupCardsByProject(sortCardsByUrgency(filteredCards)).map((group) => ({
        ...group,
        cards: sortCardsByUrgency(group.cards)
      })),
    [filteredCards]
  )
  const hasRelativeTimestamps = useMemo(
    () => snapshot.cards.some((card) => (card.finishedAt ?? card.startedAt) > 0),
    [snapshot.cards]
  )
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!hasRelativeTimestamps) {
      return
    }
    return installWindowVisibilityInterval({
      run: () => setNow(Date.now()),
      intervalMs: 30_000
    })
  }, [hasRelativeTimestamps])

  useEffect(() => {
    const handleSearchShortcut = (event: KeyboardEvent): void => {
      const usesPlatformModifier = navigator.userAgent.includes('Mac')
        ? event.metaKey
        : event.ctrlKey
      if (!usesPlatformModifier || event.key.toLowerCase() !== 'k') {
        return
      }
      if (
        event.target instanceof Element &&
        event.target.closest('input, textarea, [contenteditable="true"], .xterm')
      ) {
        return
      }
      event.preventDefault()
      searchInputRef.current?.focus()
    }
    document.addEventListener('keydown', handleSearchShortcut)
    return () => document.removeEventListener('keydown', handleSearchShortcut)
  }, [])

  // The open terminal dialog survives bucket moves: only the paneKey is
  // remembered, and the card data is re-resolved from each fresh snapshot.
  // The opened card is kept as a fallback so the dialog also survives the
  // card vanishing entirely (pane closed) — the user dismisses it explicitly.
  // Its live routing is cleared because daemon PTY ids can be reused.
  const [openedCard, setOpenedCard] = useState<DashboardCard | null>(null)
  const dialogCard = useMemo(() => {
    if (!openedCard) {
      return null
    }
    return (
      snapshot.cards.find((c) => c.paneKey === openedCard.paneKey) ?? {
        ...openedCard,
        ptyId: null,
        leafId: null
      }
    )
  }, [snapshot.cards, openedCard])
  const handleDialogOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setOpenedCard(null)
    }
  }, [])

  // Seen-state is the app-wide ack map (same signal as the sidebar's bold/mute
  // rows): opening a dialog acks the agent, and the next snapshot comes back
  // with unseen=false.
  const handleOpenTerminal = useCallback(
    (card: DashboardCard) => {
      onAckAgent(card.paneKey)
      setOpenedCard(card)
    },
    [onAckAgent]
  )
  // Watching the open dialog counts as seeing state changes as they happen —
  // without this, an agent finishing while you watch would re-flag its card.
  useEffect(() => {
    if (dialogCard?.unseen) {
      onAckAgent(dialogCard.paneKey)
    }
  }, [dialogCard?.paneKey, dialogCard?.unseen, onAckAgent])

  return (
    // Why: the pop-out is its own React root with no app-level provider, and the
    // card's repo tooltip needs one in both hosts. Nesting inside the main
    // window's provider is harmless.
    <TooltipProvider delayDuration={300}>
      <div
        className={cn('relative flex flex-col bg-background text-foreground', containerClassName)}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2.5">
          <h1 className="text-[13px] font-semibold">
            {translate('dashboardPopout.title', 'Agents')}
          </h1>
          <span className="text-[11px] text-muted-foreground">
            {translate('dashboardPopout.total', '{{count}} total', {
              count: visibleCards.length
            })}
          </span>
          <div className="ml-auto flex items-center gap-1">
            {/* Why top-right rather than in the toolbar: this is a different
                view of the same fleet, not another filter on the board. */}
            <WeeklyBudgetBadge />
            {/* Why an actual switch: this changes what the whole board shows,
                and a button that only tints when active makes "is it on"
                answerable solely by comparing it to its neighbours. */}
            <label className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 text-xs text-muted-foreground hover:text-foreground">
              <ChartNoAxesColumn className="size-3" aria-hidden />
              {translate('dashboardPopout.analytics.label', 'Efficiency')}
              <Switch
                checked={efficiencyShown}
                onCheckedChange={setEfficiencyShown}
                aria-label={translate('dashboardPopout.analytics.label', 'Efficiency')}
                className="scale-75"
              />
            </label>
          </div>
          {headerActions || onClose ? (
            <div className="flex items-center gap-1">
              {headerActions}
              {onClose ? (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label={translate('dashboardPopout.close', 'Close dashboard')}
                  className="rounded-sm p-1 text-muted-foreground opacity-70 transition-opacity hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <XIcon className="size-4" />
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        <AgentDashboardToolbar
          cards={visibleCards}
          filterOptions={snapshot.filterOptions}
          filteredCount={filteredCards.length}
          query={query}
          onQueryChange={setQuery}
          filters={filters}
          onFiltersChange={setFilters}
          searchInputRef={searchInputRef}
          density={density}
          onDensityChange={setDensity}
          orientation={orientation}
          onOrientationChange={setOrientation}
        />
        <div
          className={cn(
            'flex min-h-0 flex-1 p-3',
            orientation === 'rows'
              ? 'scrollbar-sleek overflow-y-auto'
              : 'scrollbar-sleek overflow-x-auto'
          )}
        >
          {/* Auto margins center the capped board and collapse during horizontal overflow. */}
          <div
            className={cn(
              'mx-auto flex w-full max-w-[1280px] gap-3',
              orientation === 'rows' && 'flex-col'
            )}
          >
            {projectColumns.map((group) => (
              <ProjectColumn
                key={group.projectId}
                group={group}
                repoIcon={snapshot.repoIconsByRepoId?.[group.projectId] ?? null}
                banner={snapshot.repoBannersByRepoId?.[group.projectId]}
                usageByWorktree={usageByWorktree}
                weeklyBillableTotal={weeklyBillableTotal}
                now={now}
                onOpenTerminal={handleOpenTerminal}
                onRemoveWorkspace={onRemoveWorkspace}
                density={density}
                orientation={orientation}
              />
            ))}
          </div>
        </div>
        <AgentTerminalDialog
          card={dialogCard}
          onOpenChange={handleDialogOpenChange}
          onReveal={onRevealAgent}
          onOpenFile={onOpenFile}
          onEndSession={onEndSession}
        />
      </div>
    </TooltipProvider>
  )
}
