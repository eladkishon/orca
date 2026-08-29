import { Globe, Smartphone } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import type { AgentTouchpoint } from '../../../../shared/agent-touchpoints'

/**
 * The surfaces an agent is driving, offered as one click each.
 *
 * A card can already tell you an agent loaded `localhost:3000/checkout`; what
 * it could not do was take you there. Each chip opens that exact interaction —
 * the page at its URL, not the app's front door.
 */

/** Xcode installs its own copy; the standalone path is the older layout. */
const SIMULATOR_APP_PATHS = [
  '/Applications/Xcode.app/Contents/Developer/Applications/Simulator.app',
  '/Applications/Simulator.app'
]

// ponytail: local macOS only — an SSH agent's simulator lives on its host, and
// reaching that needs the execution-host boundary, not a local path probe.
async function openSimulator(): Promise<void> {
  for (const path of SIMULATOR_APP_PATHS) {
    if (await window.api.shell.pathExists(path)) {
      await window.api.shell.openFilePath(path)
      return
    }
  }
}

function openTouchpoint(touchpoint: AgentTouchpoint): void {
  if (touchpoint.kind === 'browser' && touchpoint.url) {
    void window.api.shell.openUrl(touchpoint.url).catch(() => undefined)
    return
  }
  if (touchpoint.kind === 'simulator') {
    void openSimulator().catch(() => undefined)
  }
}

function touchpointHint(touchpoint: AgentTouchpoint): string {
  return touchpoint.kind === 'browser'
    ? translate('dashboardPopout.card.touchpoint.openPage', 'Open {{url}}', {
        url: touchpoint.url ?? touchpoint.label
      })
    : translate('dashboardPopout.card.touchpoint.openSimulator', 'Open the iOS Simulator')
}

export function AgentCardTouchpoints({
  touchpoints
}: {
  touchpoints: AgentTouchpoint[] | undefined
}): React.JSX.Element | null {
  if (!touchpoints?.length) {
    return null
  }
  return (
    <div className="flex w-full flex-wrap items-center gap-1">
      {touchpoints.map((touchpoint) => {
        const Icon = touchpoint.kind === 'browser' ? Globe : Smartphone
        const hint = touchpointHint(touchpoint)
        return (
          <Tooltip key={`${touchpoint.kind}:${touchpoint.url ?? touchpoint.label}`}>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={hint}
                onClick={(event) => {
                  event.stopPropagation()
                  openTouchpoint(touchpoint)
                }}
                className="inline-flex max-w-full shrink items-center gap-1 rounded-md border border-border/60 bg-muted/50 px-1.5 py-0.5 text-[10px] leading-none text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <Icon className="size-2.5 shrink-0" aria-hidden />
                <span className="truncate">{touchpoint.label}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={4}>
              {hint}
            </TooltipContent>
          </Tooltip>
        )
      })}
    </div>
  )
}
