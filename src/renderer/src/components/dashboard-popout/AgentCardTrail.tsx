import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'

/**
 * The last few things an agent did, collapsed under its card.
 *
 * What an agent is doing right now says nothing during a twenty-minute command
 * or a fan-out of subagents — the trail of what it just did is what shows
 * progress. Collapsed by default, because it is context you go looking for
 * rather than something to scan a board with.
 */
export function AgentCardTrail({
  commands
}: {
  commands: string[] | undefined
}): React.JSX.Element | null {
  const [open, setOpen] = useState(false)
  if (!commands?.length) {
    return null
  }
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        className="flex items-center gap-1 text-[10.5px] text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <ChevronRight className={cn('size-3 transition-transform', open && 'rotate-90')} />
        {translate('dashboardPopout.card.recent', '{{count}} recent steps', {
          count: commands.length
        })}
      </button>
      {open ? (
        <ol className="ml-1 flex flex-col gap-0.5 border-l border-border pl-2">
          {commands.map((command, index) => (
            <li
              key={`${index}-${command}`}
              className={cn(
                'truncate font-mono text-[10px] leading-[1.5]',
                // Newest last, and the newest is the one still running.
                index === commands.length - 1 ? 'text-foreground/80' : 'text-muted-foreground/70'
              )}
            >
              {command}
            </li>
          ))}
        </ol>
      ) : null}
    </>
  )
}
