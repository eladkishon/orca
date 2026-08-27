import type React from 'react'
import { useState } from 'react'
import { PlugZap } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { recoverStalledAgentPanes } from '@/lib/recover-stalled-agent-panes'
import { isAutomaticAgentStallRecoveryEnabled } from '@/lib/stalled-agent-recovery-scheduler'

/**
 * Names the panes whose agent stopped on a login or network failure, and lets
 * the user continue all of them now instead of waiting out the backoff.
 */
export function StalledAgentsStatusSegment({
  iconOnly
}: {
  iconOnly: boolean
}): React.JSX.Element | null {
  // Why the map and not a derived count: a selector returning a fresh value on
  // every store write re-renders the whole status bar (app-store-performance).
  const stalls = useAppStore((state) => state.agentStallByPaneKey)
  const autoRecoveryEnabled = useAppStore((state) =>
    isAutomaticAgentStallRecoveryEnabled(state.settings)
  )
  const [recovering, setRecovering] = useState(false)
  const stalledCount = Object.keys(stalls).length

  if (stalledCount === 0) {
    return null
  }

  const label =
    stalledCount === 1
      ? translate('auto.components.status.bar.StalledAgentsStatusSegment.one', '1 agent stalled')
      : translate(
          'auto.components.status.bar.StalledAgentsStatusSegment.many',
          '{{value0}} agents stalled',
          { value0: stalledCount }
        )
  const tooltip = autoRecoveryEnabled
    ? translate(
        'auto.components.status.bar.StalledAgentsStatusSegment.autoTooltip',
        'Stopped on a login or network failure. Orca is retrying — click to continue them all now.'
      )
    : translate(
        'auto.components.status.bar.StalledAgentsStatusSegment.manualTooltip',
        'Stopped on a login or network failure. Click to continue them all.'
      )

  const recoverNow = (): void => {
    if (recovering) {
      return
    }
    setRecovering(true)
    void recoverStalledAgentPanes({ force: true }).finally(() => {
      setRecovering(false)
    })
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={recoverNow}
          disabled={recovering}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 hover:bg-accent/70 disabled:cursor-default disabled:opacity-60"
          aria-label={tooltip}
        >
          <PlugZap className="size-3 text-destructive" />
          {!iconOnly ? <span className="text-[11px] tabular-nums">{label}</span> : null}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6}>
        {tooltip}
      </TooltipContent>
    </Tooltip>
  )
}
