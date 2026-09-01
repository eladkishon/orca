import React from 'react'
import { RotateCcw, Trash2 } from 'lucide-react'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { AgentIcon } from '@/lib/agent-catalog'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type { WorktreeCardController } from './use-worktree-card-controller'
import type { WorktreeCardPresentation } from './worktree-card-presentation'

const quickActionClassName =
  'inline-flex size-4 items-center justify-center rounded bg-transparent transition-colors ' +
  'text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:text-foreground'

// Why: delete stays hidden until Option/Alt, so it keeps the reveal-on-hover treatment the others dropped.
const deleteQuickActionClassName = cn(
  'inline-flex size-4 items-center justify-center rounded bg-transparent opacity-0 transition-colors transition-opacity',
  'group-hover/worktree-card:opacity-100 group-focus-within/worktree-card:opacity-100 focus-visible:opacity-100',
  'text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:bg-destructive/10 focus-visible:text-destructive'
)

function QuickAction({
  label,
  onClick,
  onPointerDown,
  className,
  children
}: {
  label: string
  onClick: React.MouseEventHandler<HTMLButtonElement>
  onPointerDown: React.PointerEventHandler<HTMLButtonElement>
  className: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          data-workspace-board-preserve-open=""
          onPointerDown={onPointerDown}
          onClick={onClick}
          className={className}
          aria-label={label}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

export function WorktreeCardQuickActions({
  card,
  presentation
}: {
  card: WorktreeCardController
  presentation: WorktreeCardPresentation
}): React.JSX.Element {
  const { stopQuickActionPointerPropagation, handleWorkspaceQuickAction, handleResetToBase } = card
  const { showDeleteQuickAction, showResetToBaseQuickAction, showLaunchClaudeQuickAction } =
    presentation

  return (
    <>
      {showLaunchClaudeQuickAction && (
        <QuickAction
          label={translate(
            'auto.components.sidebar.WorktreeCard.launchClaude',
            'Start a new Claude session here'
          )}
          onClick={card.handleLaunchClaude}
          onPointerDown={stopQuickActionPointerPropagation}
          className={quickActionClassName}
        >
          <AgentIcon agent="claude" size={13} />
        </QuickAction>
      )}

      {showResetToBaseQuickAction && (
        <QuickAction
          label={translate(
            'auto.components.sidebar.WorktreeCard.resetToBase',
            'Switch to the updated default branch'
          )}
          onClick={handleResetToBase}
          onPointerDown={stopQuickActionPointerPropagation}
          className={quickActionClassName}
        >
          <RotateCcw className="size-3.5" />
        </QuickAction>
      )}

      {showDeleteQuickAction && (
        <QuickAction
          label={translate('auto.components.sidebar.WorktreeCard.6f09f58541', 'Delete workspace')}
          onClick={handleWorkspaceQuickAction}
          onPointerDown={stopQuickActionPointerPropagation}
          className={deleteQuickActionClassName}
        >
          <Trash2 className="size-3.5" />
        </QuickAction>
      )}
    </>
  )
}
