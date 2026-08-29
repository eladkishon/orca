import { memo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronRight, GitBranch, Trash2 } from 'lucide-react'
import { AgentIcon } from '@/lib/agent-catalog'
import { agentTypeToIconAgent, formatAgentTypeLabel } from '@/lib/agent-status'
import { AgentQuestionIcon } from '@/components/AgentQuestionIcon'
import { AgentStateDot } from '@/components/AgentStateDot'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import {
  dashboardCardDisplayState,
  type DashboardCard
} from '../../../../shared/dashboard-snapshot'
import { translate } from '@/i18n/i18n'
import { DashboardHostBadge } from './DashboardHostBadge'
import './agent-card-state.css'
import { dashboardCardDensityStyle, type DashboardCardDensity } from './dashboard-card-density'
import { dashboardCardPace } from './agent-card-pace'
import { condenseAgentMessage } from './condense-agent-message'
import { agentCardStallReason } from './agent-card-stall-reason'
import { AgentActivityBadge } from './AgentActivityBadge'
import { AgentCardTrail } from './AgentCardTrail'
import { AgentCardContextMenu } from './AgentCardContextMenu'
import { AgentEfficiencyBadge } from './AgentEfficiencyBadge'
import type { AgentEfficiencyInput } from '../../../../shared/agent-efficiency'
import { AgentKanbanCardBadges } from './AgentKanbanCardBadges'

/** Compact "started N ago" (the card is glanceable — coarse units are fine). */
function formatStartedAgo(startedAt: number, now: number): string {
  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000))
  if (seconds < 60) {
    return translate('dashboardPopout.card.time.justNow', 'just now')
  }
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) {
    return translate('dashboardPopout.card.time.minutes', '{{count}}m', { count: minutes })
  }
  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return translate('dashboardPopout.card.time.hours', '{{count}}h', { count: hours })
  }
  return translate('dashboardPopout.card.time.days', '{{count}}d', {
    count: Math.floor(hours / 24)
  })
}

/** The timestamp the card's time column counts from: since it finished when the
 *  agent has completed, else since it started — parity with the worktree sidebar. */
function displayTimestamp(card: DashboardCard): number {
  return card.finishedAt ?? card.startedAt
}

function formatSubagentCount(count: number): string {
  return count === 1
    ? translate('dashboardPopout.card.subagents_one', '{{count}} subagent', { count })
    : translate('dashboardPopout.card.subagents_other', '{{count}} subagents', { count })
}

function sameSubagents(a: DashboardCard['subagents'], b: DashboardCard['subagents']): boolean {
  if (a === b) {
    return true
  }
  if (!a || !b || a.length !== b.length) {
    return false
  }
  for (let index = 0; index < a.length; index += 1) {
    if (!(index in a) || !(index in b)) {
      if (index in a !== index in b) {
        return false
      }
      continue
    }
    const subagent = a[index]
    const other = b[index]
    if (
      subagent.id !== other.id ||
      subagent.name !== other.name ||
      subagent.dotState !== other.dotState
    ) {
      return false
    }
  }
  return true
}

function sameCard(a: DashboardCard, b: DashboardCard): boolean {
  return (
    a.paneKey === b.paneKey &&
    a.ptyId === b.ptyId &&
    a.agentType === b.agentType &&
    a.bucket === b.bucket &&
    a.dotState === b.dotState &&
    a.workingMode === b.workingMode &&
    a.task === b.task &&
    a.activity === b.activity &&
    a.recentCommands?.length === b.recentCommands?.length &&
    a.recentCommands?.at(-1) === b.recentCommands?.at(-1) &&
    a.lastUserMessage === b.lastUserMessage &&
    a.titleFromPrompt === b.titleFromPrompt &&
    a.lastAgentMessage === b.lastAgentMessage &&
    a.repoId === b.repoId &&
    a.worktreeId === b.worktreeId &&
    a.tabId === b.tabId &&
    a.leafId === b.leafId &&
    a.repoName === b.repoName &&
    a.worktreeName === b.worktreeName &&
    a.hostKind === b.hostKind &&
    a.executionHostId === b.executionHostId &&
    a.hostLabel === b.hostLabel &&
    a.hasReview === b.hasReview &&
    a.isMainWorktree === b.isMainWorktree &&
    a.review?.number === b.review?.number &&
    a.review?.state === b.review?.state &&
    a.review?.checksStatus === b.review?.checksStatus &&
    a.review?.url === b.review?.url &&
    a.linearIssue?.identifier === b.linearIssue?.identifier &&
    a.linearIssue?.url === b.linearIssue?.url &&
    sameSubagents(a.subagents, b.subagents) &&
    a.startedAt === b.startedAt &&
    a.finishedAt === b.finishedAt &&
    a.stateChangedAt === b.stateChangedAt &&
    a.unseen === b.unseen &&
    a.askSummary === b.askSummary &&
    a.conversationName === b.conversationName
  )
}

type AgentKanbanCardProps = {
  card: DashboardCard
  now: number
  /** Opens the board-level terminal dialog. The dialog is NOT owned by the
   *  card: bucket moves remount the card, and an embedded dialog would close
   *  the chat mid-conversation. */
  onOpenTerminal: (card: DashboardCard) => void
  /** Removes the card's worktree. Only offered on idle cards, and only when the
   *  host supplies it — the confirm and the deletion itself live there. */
  onRemoveWorkspace?: (card: DashboardCard) => void
  /** Ends the agent's session. Offered where there is no worktree to remove. */
  onEndSession?: (card: DashboardCard) => void
  /** How much of the agent to show. Detailed makes the card a small window
   *  onto it rather than a row you scan. */
  density?: DashboardCardDensity
  /** What the usage scan attributed to this agent's worktree, when it could. */
  usage?: AgentEfficiencyInput
  /** Everything billed this week, so a card can state its share of it. */
  weeklyBillableTotal?: number
  /** Silence allowed before this card reads as stalled; the board's setting. */
  stallAfterMs?: number
}

/** One agent on the kanban board. Clicking opens the board's live terminal dialog. */
export const AgentKanbanCard = memo(
  function AgentKanbanCard({
    card,
    now,
    onOpenTerminal,
    onRemoveWorkspace,
    onEndSession,
    density = 'compact',
    usage,
    weeklyBillableTotal = 0,
    stallAfterMs
  }: AgentKanbanCardProps): React.JSX.Element {
    useTranslation()
    const style = dashboardCardDensityStyle(density)
    const pace = dashboardCardPace(card, now, stallAfterMs)
    const [subagentsOpen, setSubagentsOpen] = useState(style.subagentsOpen)
    // Why: the two outcomes worth scanning for get a tinted card — the
    // --agent-question accent for "answer me", green for "finished, look at
    // it". Everything else stays neutral so the tint keeps meaning something.
    const displayState = dashboardCardDisplayState(card)
    // Why: the session's own name heads the card. Without one the worktree is
    // the best heading left — and then the footer drops it rather than say it
    // twice.
    const heading = card.conversationName ?? card.worktreeName
    const hasCornerBadges = Boolean(card.review || card.linearIssue)
    const removeLabel = translate('dashboardPopout.card.removeWorktree', 'Remove worktree')
    // Why: colour alone cannot say why a card warmed up. Hovering explains it
    // without spending a line of the card on a state that is usually absent.
    const paceTitle =
      pace === 'stalled'
        ? translate('dashboardPopout.card.pace.stalled', 'Working, but silent for a while')
        : pace === 'slow'
          ? translate('dashboardPopout.card.pace.slow', 'Working, no update recently')
          : undefined
    // Why exclude the primary checkout: git refuses to delete a main tree, so
    // the button would either fail or be read as an offer to delete the project.
    const canRemove =
      card.bucket === 'idle' && !card.isMainWorktree && onRemoveWorkspace !== undefined
    // Why merged specifically: idle only means "the agent stopped and you
    // looked at it" (dashboardCardDisplayState in dashboard-snapshot.ts) — it
    // says nothing about whether the work is actually finished. A merged PR is
    // the one fact already on the card that does: nothing further can land on
    // this branch, so its worktree is safe to delete outright rather than
    // something you have to remember to double-check first. Cards with no
    // linked review, or one still open/draft, keep only the quiet hover icon.
    const isConfidentlyDone = canRemove && card.review?.state === 'merged'
    const deleteDoneLabel = translate(
      'dashboardPopout.card.deleteCompletedWorktree',
      'PR merged — delete worktree'
    )
    // Why: the badge already says "main"; repeating it as the worktree name is
    // the same word twice in one row.
    const worktreeInFooter =
      card.conversationName !== undefined &&
      !(card.isMainWorktree && card.worktreeName.toLowerCase() === 'main')

    const card_ = (
      <div
        // Why: a stable per-agent view-transition-name lets the browser morph
        // the card from its old column to its new one when its bucket changes.
        // paneKey has ':'/'/' which aren't valid in a custom-ident, so slugify.
        style={{ viewTransitionName: `agentcard-${card.paneKey.replace(/[^a-zA-Z0-9]/g, '-')}` }}
        // Why: state lives on the border (see agent-card-state.css). It is the
        // largest shape on the card and the one thing that cannot be crowded
        // out of the corner, which is what happened to the dot.
        data-agent-state={displayState}
        // Why: state says what the agent claims to be doing; pace says whether
        // it is actually getting on with it. The stylesheet spends the beam's
        // motion on pace, so a still ring means "not advancing".
        data-agent-pace={pace}
        title={paceTitle}
        className={cn(
          'agent-card-state group relative flex w-full flex-col rounded-xl text-left',
          style.card,
          // Why: the reason sits on the top frame, so the content starts below it.
          pace !== 'advancing' && 'pt-5',
          'transition-[transform,background-color] duration-200 ease-out',
          'hover:-translate-y-px',
          // Feedback belongs on the press, not the release.
          'active:translate-y-0 active:scale-[0.995] active:duration-75',
          'motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100'
        )}
      >
        {/* Why: a stopped ring says "not advancing" but cannot say whether the
            agent is logged out, waiting on a dead network, or three minutes
            into a legitimate build — the first two want you now, the third
            wants you to leave it alone. The reason rides on the frame it
            belongs to, centred so it reads as part of the ring rather than as
            one more line of card content. */}
        {pace === 'advancing' ? null : (
          <span className="absolute top-0 left-1/2 z-[3] -translate-x-1/2 rounded-b-md bg-amber-500/15 px-1.5 py-px text-[9.5px] font-medium tracking-[0.02em] text-amber-700 dark:text-amber-300">
            {agentCardStallReason(card)}
          </span>
        )}
        {/* Why: the corner sits above the open-terminal button because the
            review and ticket are their own links — a button cannot nest in a
            button — and the heading reserves room so it truncates, not overlaps. */}
        <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1.5">
          {/* Why a standing pill instead of the quiet hover icon: a merged PR
              is a confident "this is actually done," not just "idle," and
              deserves a control you notice without hovering — the hover-only
              icon below is deliberately easy to miss for the common idle case
              where you might still want to look the work over first. */}
          {isConfidentlyDone ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={deleteDoneLabel}
                  onClick={() => onRemoveWorkspace?.(card)}
                  className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none dark:text-emerald-400"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                  {translate('dashboardPopout.card.deleteCompletedShort', 'Delete')}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={4}>
                {deleteDoneLabel}
              </TooltipContent>
            </Tooltip>
          ) : canRemove ? (
            // Why: only idle cards offer removal — a working or waiting agent's
            // worktree is still in use. It stays hidden until the card is
            // hovered or the control itself is focused, so the board does not
            // read as a row of delete buttons.
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={removeLabel}
                  onClick={() => onRemoveWorkspace?.(card)}
                  className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={4}>
                {removeLabel}
              </TooltipContent>
            </Tooltip>
          ) : null}
          <AgentKanbanCardBadges card={card} />
        </div>

        <button
          type="button"
          onClick={() => onOpenTerminal(card)}
          className="flex w-full flex-col gap-1.5 text-left focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {/* Why: the command chip below says the literal command; this says
              what that command IS. Scanning a board for "who is testing" should
              not mean reading a dozen shell invocations. */}
          <AgentActivityBadge activity={card.activity} />

          <div
            className={cn(
              'flex w-full items-center gap-1.5',
              hasCornerBadges ? (canRemove ? 'pe-36' : 'pe-28') : canRemove ? 'pe-12' : 'pe-4'
            )}
          >
            <span
              className={cn(
                // Why: the heading is what you scan a column by, so it leads
                // the card outright. Unseen is carried by colour alone now —
                // the weight is already at the top of the scale.
                // Why: tracking is size-specific — large text reads too loose
                // at default spacing, so the heading tightens while the small
                // copy below it opens up.
                'font-semibold',
                style.heading,
                style.headingClamp,
                card.unseen ? 'text-foreground' : 'text-foreground/70'
              )}
            >
              {heading}
            </span>
          </div>

          {card.lastUserMessage || card.lastAgentMessage ? (
            <div className="flex w-full flex-col gap-1.5">
              {card.lastUserMessage && !card.titleFromPrompt ? (
                <div
                  className={cn(
                    'text-[11px] leading-[1.45] tracking-[0.005em] text-muted-foreground',
                    style.userMessageClamp
                  )}
                >
                  <span className="font-semibold text-foreground/45">
                    {translate('dashboardPopout.card.you', 'You')}
                  </span>{' '}
                  {condenseAgentMessage(card.lastUserMessage, style.userMessageChars)}
                </div>
              ) : null}
              {card.lastAgentMessage ? (
                <div className={cn('text-foreground/85', style.message, style.agentMessageClamp)}>
                  <span className="font-semibold text-foreground/45">
                    {formatAgentTypeLabel(card.agentType)}
                  </span>{' '}
                  {condenseAgentMessage(card.lastAgentMessage, style.agentMessageChars)}
                </div>
              ) : null}
            </div>
          ) : card.task ? (
            <div
              className={cn('w-full text-foreground/85', style.message, style.agentMessageClamp)}
            >
              {condenseAgentMessage(card.task, style.agentMessageChars)}
            </div>
          ) : null}

          {/* Why: the row is always present, filled or not. Sizing it to its
            content makes every card grow and shrink as its agent moves between
            tools, and a board of those jumps under the pointer. */}
          <div data-agent-card-activity className={cn('flex w-full', style.activity)}>
            {card.activity ? (
              // Why: a chip separates "what it is running now" from the prose
              // above it. Small type wants slightly positive tracking to stay
              // legible, the inverse of the heading.
              <span
                className={cn(
                  'max-w-full rounded-md bg-muted/70 px-1.5 py-0.5 font-mono text-[10.5px] tracking-[0.01em] text-foreground/70',
                  density === 'detailed'
                    ? 'break-all whitespace-pre-wrap leading-[1.45]'
                    : 'truncate leading-none'
                )}
              >
                {card.activity}
              </span>
            ) : null}
          </div>

          {card.askSummary ? (
            <div className="flex w-full items-start gap-1 rounded-md bg-agent-question/15 px-1.5 py-1 text-[11px] text-agent-question-text ring-1 ring-inset ring-agent-question/25">
              <AgentQuestionIcon className="mt-px size-3 shrink-0" />
              <span className="line-clamp-2">{card.askSummary}</span>
            </div>
          ) : null}
        </button>

        <AgentCardTrail commands={card.recentCommands} />

        {card.subagents?.length ? (
          <>
            <button
              type="button"
              aria-expanded={subagentsOpen}
              onClick={() => setSubagentsOpen((open) => !open)}
              className="flex items-center gap-1 text-[10.5px] text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <ChevronRight
                className={cn('size-3 transition-transform', subagentsOpen && 'rotate-90')}
              />
              {formatSubagentCount(card.subagents.length)}
            </button>
            {subagentsOpen ? (
              <div className="ml-1 flex flex-col gap-1 border-l border-border pl-2">
                {card.subagents.map((subagent) => (
                  <div
                    key={subagent.id}
                    className="flex items-center gap-1.5 py-0.5 text-[11px] text-muted-foreground"
                  >
                    <AgentStateDot state={subagent.dotState} />
                    <span className="truncate">{subagent.name}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        ) : null}

        <button
          type="button"
          onClick={() => onOpenTerminal(card)}
          className="mt-0.5 flex w-full items-center gap-1.5 rounded-md border-t border-border/50 pt-2 text-left text-[10.5px] tracking-[0.01em] text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <span className="inline-flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
            {/* Why: a bare <svg> flex item shrinks with the row. */}
            <span className="inline-flex shrink-0">
              <AgentIcon agent={agentTypeToIconAgent(card.agentType)} size={11} />
            </span>
            {formatAgentTypeLabel(card.agentType)}
          </span>
          <DashboardHostBadge
            hostKind={card.hostKind}
            executionHostId={card.executionHostId}
            hostLabel={card.hostLabel}
            className="size-[16px] rounded-[4px] bg-muted-foreground/10 transition-colors group-hover:text-foreground"
          />
          {/* Why: which checkout an agent is in changes what its edits touch —
              the primary tree is shared, a worktree is its own. Worth stating
              on the card rather than inferring from the branch name. */}
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  'inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-px text-[9.5px] font-medium tracking-[0.02em]',
                  card.isMainWorktree
                    ? 'bg-amber-500/10 text-amber-700/90 dark:text-amber-300/90'
                    : 'bg-muted-foreground/10 text-muted-foreground'
                )}
              >
                {card.isMainWorktree ? null : <GitBranch className="size-2.5" aria-hidden />}
                {card.isMainWorktree
                  ? translate('dashboardPopout.card.checkout.main', 'main')
                  : translate('dashboardPopout.card.checkout.worktree', 'worktree')}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={4}>
              {card.isMainWorktree
                ? translate(
                    'dashboardPopout.card.checkout.mainHint',
                    'Working in the project’s primary checkout'
                  )
                : translate(
                    'dashboardPopout.card.checkout.worktreeHint',
                    'Working in its own git worktree'
                  )}
            </TooltipContent>
          </Tooltip>
          {worktreeInFooter ? <span className="truncate">{card.worktreeName}</span> : null}
          <AgentEfficiencyBadge
            usage={usage}
            weeklyBillableTotal={weeklyBillableTotal}
            scope="worktree"
          />
          {displayTimestamp(card) > 0 ? (
            <span className="ml-auto shrink-0 pl-1 tabular-nums">
              {formatStartedAgo(displayTimestamp(card), now)}
            </span>
          ) : null}
        </button>
      </div>
    )
    return (
      <AgentCardContextMenu
        card={card}
        onRemoveWorkspace={onRemoveWorkspace}
        onEndSession={onEndSession}
      >
        {card_}
      </AgentCardContextMenu>
    )
  },
  (previous, next) =>
    previous.onOpenTerminal === next.onOpenTerminal &&
    previous.onRemoveWorkspace === next.onRemoveWorkspace &&
    previous.onEndSession === next.onEndSession &&
    previous.density === next.density &&
    previous.usage === next.usage &&
    previous.weeklyBillableTotal === next.weeklyBillableTotal &&
    previous.stallAfterMs === next.stallAfterMs &&
    // Why: the timestamp guard below only re-renders on a coarse label change,
    // which would hold a card at its old pace for up to a minute.
    dashboardCardPace(previous.card, previous.now, previous.stallAfterMs) ===
      dashboardCardPace(next.card, next.now, next.stallAfterMs) &&
    sameCard(previous.card, next.card) &&
    (displayTimestamp(previous.card) <= 0 ||
      formatStartedAgo(displayTimestamp(previous.card), previous.now) ===
        formatStartedAgo(displayTimestamp(next.card), next.now))
)
