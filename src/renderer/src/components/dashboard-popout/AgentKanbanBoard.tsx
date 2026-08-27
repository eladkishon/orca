import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { XIcon } from 'lucide-react'
import {
  DASHBOARD_BUCKET_ORDER,
  type DashboardBucket,
  type DashboardCard,
  type DashboardOpenFileArgs,
  type DashboardSnapshot
} from '../../../../shared/dashboard-snapshot'
import type { RepoIcon } from '../../../../shared/repo-icon'
import { cn } from '@/lib/utils'
import { TooltipProvider } from '@/components/ui/tooltip'
import { installWindowVisibilityInterval } from '@/lib/window-visibility-interval'
import { AgentKanbanCard } from './AgentKanbanCard'
import { RepoIconGlyph } from '@/components/repo/repo-icon'
import { groupCardsByProject } from './dashboard-column-groups'
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

/** Remove a workspace from the pop-out: the main renderer runs the ordinary
 *  delete funnel, confirm included. Same `?.` HMR-skew guard as the relays above. */
function removeWorkspaceViaPopoutRelay(card: DashboardCard): void {
  void window.api.dashboard.removeWorkspace?.({
    worktreeId: card.worktreeId,
    ...(card.executionHostId ? { executionHostId: card.executionHostId } : {})
  })
}

function bucketLabel(bucket: DashboardBucket): string {
  switch (bucket) {
    case 'attention':
      return translate('dashboardPopout.bucket.attention', 'Needs You')
    case 'working':
      return translate('dashboardPopout.bucket.working', 'Working')
    case 'done':
      return translate('dashboardPopout.bucket.done', 'Done')
    case 'idle':
      return translate('dashboardPopout.bucket.idle', 'Idle')
  }
}

function groupByBucket(cards: DashboardCard[]): Record<DashboardBucket, DashboardCard[]> {
  const grouped: Record<DashboardBucket, DashboardCard[]> = {
    attention: [],
    working: [],
    done: [],
    idle: []
  }
  for (const card of cards) {
    grouped[card.bucket].push(card)
  }
  // Most-recently-moved first: a card entering a column lands at the top,
  // matching the view-transition motion the user just watched.
  for (const bucket of DASHBOARD_BUCKET_ORDER) {
    grouped[bucket].sort((a, b) => b.stateChangedAt - a.stateChangedAt)
  }
  return grouped
}

function KanbanColumn({
  bucket,
  cards,
  repoIconsByRepoId,
  now,
  onOpenTerminal,
  onRemoveWorkspace,
  density,
  orientation
}: {
  bucket: DashboardBucket
  cards: DashboardCard[]
  repoIconsByRepoId: Record<string, RepoIcon | null> | undefined
  now: number
  onOpenTerminal: (card: DashboardCard) => void
  onRemoveWorkspace: (card: DashboardCard) => void
  density: DashboardCardDensity
  orientation: DashboardBoardOrientation
}): React.JSX.Element {
  return (
    // Why: attention no longer tints the whole column — the cards inside carry
    // their own state color, so a column border would double-signal it.
    <section
      className={cn(
        'flex flex-col rounded-xl border border-border/60 bg-muted/30',
        orientation === 'rows'
          ? // A band per state: full width, height driven by its contents.
            'w-full min-w-0 shrink-0'
          : cn(
              'flex-1',
              // Why: detail is only detail if the lines have room to be lines.
              // A wider card at the same width would just wrap more.
              density === 'detailed' ? 'min-w-[360px]' : 'min-w-[264px]'
            )
      )}
    >
      <header className="flex items-center gap-2 px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
          {bucketLabel(bucket)}
        </span>
        <span className="ml-auto rounded-full bg-background px-1.5 text-[11px] tabular-nums text-muted-foreground">
          {cards.length}
        </span>
      </header>
      <div
        className={cn(
          'flex gap-3 px-2 pb-2',
          orientation === 'rows'
            ? // The project boxes run across the band; their cards still stack.
              'scrollbar-sleek flex-row overflow-x-auto'
            : 'scrollbar-sleek min-h-0 flex-1 flex-col overflow-y-auto'
        )}
      >
        {cards.length === 0 ? (
          <p className="px-1 py-2 text-[11px] text-muted-foreground">
            {translate('dashboardPopout.bucket.empty', 'None')}
          </p>
        ) : (
          groupCardsByProject(cards).map((group) => (
            // A box per project: every agent working on the same repo reads as
            // one unit, instead of a flat queue whose owners are only
            // distinguishable by icon. A div and not a section, because the
            // column-border assertion walks every section on the board.
            <div
              key={group.projectId}
              className={cn(
                'flex flex-col gap-2 rounded-xl border border-border/50 bg-background/50 p-2',
                orientation === 'rows' &&
                  (density === 'detailed' ? 'w-[360px] shrink-0' : 'w-[272px] shrink-0')
              )}
            >
              <div className="flex items-center gap-2 px-0.5 pb-0.5">
                <span className="inline-flex size-4 shrink-0 items-center justify-center text-muted-foreground">
                  <RepoIconGlyph
                    repoIcon={repoIconsByRepoId?.[group.projectId] ?? null}
                    className="size-3.5"
                    iconClassName="size-3.5"
                  />
                </span>
                <span className="truncate text-[13px] leading-tight font-semibold tracking-[-0.006em] text-foreground">
                  {group.projectName}
                </span>
                <span className="ml-auto shrink-0 text-[11px] tabular-nums text-muted-foreground/70">
                  {group.cards.length}
                </span>
              </div>
              {group.cards.map((card) => (
                <AgentKanbanCard
                  key={card.paneKey}
                  card={card}
                  repoIcon={repoIconsByRepoId?.[card.repoId] ?? null}
                  now={now}
                  onOpenTerminal={onOpenTerminal}
                  onRemoveWorkspace={onRemoveWorkspace}
                  density={density}
                />
              ))}
            </div>
          ))
        )}
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
  onClose,
  headerActions
}: AgentKanbanBoardProps): React.JSX.Element {
  const visibleBuckets = useMemo(
    () =>
      DASHBOARD_BUCKET_ORDER.filter((bucket) => bucket !== 'idle' || snapshot.showIdle === true),
    [snapshot.showIdle]
  )
  const visibleCards = useMemo(
    () => snapshot.cards.filter((card) => visibleBuckets.includes(card.bucket)),
    [snapshot.cards, visibleBuckets]
  )
  const [query, setQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [filters, setFilters] = useState<DashboardFilters>(EMPTY_DASHBOARD_FILTERS)
  // Why: board-local like the filters beside it. Detail is a reading mode you
  // flip for the task in front of you, not a setting you configure once.
  const [density, setDensity] = useState<DashboardCardDensity>('compact')
  const [orientation, setOrientation] = useState<DashboardBoardOrientation>('columns')
  const filteredCards = useMemo(
    () => filterDashboardCards(visibleCards, query, filters),
    [visibleCards, filters, query]
  )
  const grouped = useMemo(() => groupByBucket(filteredCards), [filteredCards])
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
          {headerActions || onClose ? (
            <div className="ml-auto flex items-center gap-1">
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
            {visibleBuckets.map((bucket) => (
              <KanbanColumn
                key={bucket}
                bucket={bucket}
                cards={grouped[bucket]}
                repoIconsByRepoId={snapshot.repoIconsByRepoId}
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
        />
      </div>
    </TooltipProvider>
  )
}
