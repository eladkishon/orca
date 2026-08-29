import { useEffect, useId } from 'react'
import { SquareArrowOutUpRight, XIcon } from 'lucide-react'
import { AgentIcon } from '@/lib/agent-catalog'
import { agentTypeToIconAgent, formatAgentTypeLabel } from '@/lib/agent-status'
import { agentStateLabel } from '@/components/AgentStateDot'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  dashboardCardDisplayState,
  type DashboardCard,
  type DashboardOpenFileArgs,
  type DashboardRevealAgentArgs
} from '../../../../shared/dashboard-snapshot'
import { AgentTerminalPreview } from './AgentTerminalPreview'
import { EndSessionButton } from './EndSessionButton'
import type { PreviewFileLinkActivation } from './preview-terminal-file-links'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'

/** Routing payload for focusing an agent's pane in the main window. */
export type AgentRevealArgs = DashboardRevealAgentArgs

type AgentTerminalDialogProps = {
  /** The agents shown in the dialog; empty renders it closed. More than one is
   *  the split grid — Cmd/Ctrl+D in a preview starts another session here. */
  cards: readonly DashboardCard[]
  onOpenChange: (open: boolean) => void
  /** Focus the agent's pane. The pop-out relays over IPC; the in-window host
   *  activates the worktree/pane locally. */
  onReveal: (args: AgentRevealArgs) => void
  /** Ends the agent's session by closing its tab. The worktree is untouched. */
  onEndSession: (card: DashboardCard) => void
  /** Follow a file link in the preview, routed the same two ways as onReveal. */
  onOpenFile: (args: DashboardOpenFileArgs) => void
  /** The split chord: start another session in this agent's workspace and show
   *  it beside this one. Omitted leaves the chord swallowed. */
  onSplitSession?: (card: DashboardCard) => void
  /** Closes one tile of the grid; the last one closes the dialog. */
  onCloseCard?: (paneKey: string) => void
}

type AgentTerminalFrameProps = Omit<AgentTerminalDialogProps, 'cards'> & {
  card: DashboardCard
  title: React.ReactNode
  previewClassName?: string
}

function AgentTerminalFrame({
  card,
  title,
  previewClassName,
  onOpenChange,
  onReveal,
  onOpenFile,
  onEndSession,
  onSplitSession,
  onCloseCard
}: AgentTerminalFrameProps): React.JSX.Element {
  const openFileLink = (activation: PreviewFileLinkActivation): void => {
    onOpenFile({
      worktreeId: card.worktreeId,
      executionHostId: card.executionHostId,
      path: activation.path,
      line: activation.line,
      column: activation.column,
      openWithSystemDefault: activation.openWithSystemDefault
    })
  }

  // Why: revealing does not dismiss the preview. From the pop-out this focuses
  // the pane in the MAIN window, so closing the pop-out's own preview threw
  // away the view the user was watching to get somewhere else. The in-window
  // board still closes, but that is its host's call — the drawer overlays the
  // very pane being revealed, so it dismisses itself in onRevealAgent.
  const reveal = (): void => {
    onReveal({
      repoId: card.repoId,
      worktreeId: card.worktreeId,
      executionHostId: card.executionHostId,
      tabId: card.tabId,
      leafId: card.leafId
    })
  }

  return (
    <>
      <div className="flex shrink-0 items-center gap-1.5 px-2.5 py-2">
        <span className="inline-flex shrink-0">
          <AgentIcon agent={agentTypeToIconAgent(card.agentType)} size={13} />
        </span>
        {title}
        <span className="text-[11px] text-muted-foreground">
          {formatAgentTypeLabel(card.agentType)} ·{' '}
          {agentStateLabel(dashboardCardDisplayState(card))}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="ml-auto opacity-70 hover:opacity-100"
          onClick={() => (onCloseCard ? onCloseCard(card.paneKey) : onOpenChange(false))}
        >
          <XIcon className="size-4" />
          <span className="sr-only">{translate('dashboardPopout.terminal.close', 'Close')}</span>
        </Button>
      </div>
      {card.ptyId ? (
        <AgentTerminalPreview
          ptyId={card.ptyId}
          terminalInput={card.terminalInput ?? null}
          onOpenFileLink={openFileLink}
          {...(onSplitSession ? { onSplitSession: () => onSplitSession(card) } : {})}
          className={previewClassName}
        />
      ) : (
        <div className="min-h-0 flex-1 px-2.5 pb-2 text-[11px] text-muted-foreground">
          {translate(
            'dashboardPopout.terminal.closed',
            "No live terminal — this agent's pane has closed."
          )}
        </div>
      )}
      <div className="flex shrink-0 items-center gap-1.5 px-2.5 py-1.5">
        {/* Why: ending a session belongs next to opening it — both are things
            you decide from the preview, and sending the user to another page to
            delete what they are looking at is how a done agent stays forever. */}
        <EndSessionButton
          onEnd={() => {
            onEndSession(card)
            onOpenChange(false)
          }}
        />
        <Button type="button" variant="outline" size="xs" className="ml-auto" onClick={reveal}>
          <SquareArrowOutUpRight className="size-3" />
          {translate('dashboardPopout.terminal.focusWorktree', 'Open worktree')}
        </Button>
      </div>
    </>
  )
}

/**
 * The near-fullscreen live-terminal view for one agent — or several, once the
 * split chord has started more in the same workspace. Hosted by the BOARD, not
 * the card: sending a message flips the agent's bucket, which remounts its card
 * in another column, and a card-owned dialog would close mid-conversation.
 */
export function AgentTerminalDialog({
  cards,
  onOpenChange,
  onReveal,
  onOpenFile,
  onEndSession,
  onSplitSession,
  onCloseCard
}: AgentTerminalDialogProps): React.JSX.Element {
  // Square-ish: the tiles are terminals, so neither a single row nor a single
  // column keeps them readable past two.
  const columns = Math.ceil(Math.sqrt(Math.max(1, cards.length)))
  return (
    <Dialog open={cards.length > 0} onOpenChange={onOpenChange}>
      {cards.length > 0 ? (
        <DialogContent
          aria-describedby={undefined}
          // Why: sm:max-w-lg in DialogContent's base classes would defeat a bare
          // max-w-*, so the full-width override must carry the same breakpoint.
          className="grid h-[calc(100vh-40px)] w-[calc(100vw-40px)] max-w-none gap-2 p-2 sm:max-w-none"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          // Why: the default close X sits at top-4/right-4 (tuned for p-6
          // dialogs), which misaligns against this p-0 compact header; render
          // it inside the header row instead so it centers with the title.
          showCloseButton={false}
          // Why: the preview focuses its terminal once the snapshot paints;
          // Radix's default focus target would tug focus away first.
          onOpenAutoFocus={(e) => {
            if (cards[0]?.ptyId) {
              e.preventDefault()
            }
          }}
        >
          <DialogTitle className="sr-only">{cards[0]?.worktreeName}</DialogTitle>
          {cards.map((card) => (
            <div
              key={card.paneKey}
              className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-md border border-border"
            >
              <AgentTerminalFrame
                card={card}
                title={
                  <span className="text-[12px] leading-normal font-semibold">
                    {card.worktreeName}
                  </span>
                }
                previewClassName="h-auto min-h-0 flex-1"
                onOpenChange={onOpenChange}
                onReveal={onReveal}
                onOpenFile={onOpenFile}
                onEndSession={onEndSession}
                {...(onSplitSession ? { onSplitSession } : {})}
                {...(onCloseCard && cards.length > 1 ? { onCloseCard } : {})}
              />
            </div>
          ))}
        </DialogContent>
      ) : null}
    </Dialog>
  )
}

export function AgentTerminalPanel({
  card,
  onOpenChange,
  onReveal,
  onOpenFile,
  onEndSession,
  className
}: Omit<AgentTerminalDialogProps, 'cards'> & {
  card: DashboardCard
  className?: string
}): React.JSX.Element {
  const titleId = useId()

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      // Why: the preview's key handler refuses Escape rather than sending it,
      // so it closes the panel here instead of interrupting the agent —
      // interrupting is Ctrl+C, which still reaches the terminal.
      if (event.key === 'Escape' && !event.defaultPrevented) {
        onOpenChange(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onOpenChange])

  return (
    <section
      role="dialog"
      data-state="open"
      aria-labelledby={titleId}
      className={cn(
        'm-3 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-[0_10px_24px_rgba(0,0,0,0.18)]',
        className
      )}
    >
      <AgentTerminalFrame
        card={card}
        title={
          <h2 id={titleId} className="text-[12px] leading-normal font-semibold">
            {card.worktreeName}
          </h2>
        }
        previewClassName="h-auto min-h-0 flex-1"
        onOpenChange={onOpenChange}
        onReveal={onReveal}
        onOpenFile={onOpenFile}
        onEndSession={onEndSession}
      />
    </section>
  )
}
