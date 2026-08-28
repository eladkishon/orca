import { useEffect, useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'

/** How long the armed state waits before giving the click back. */
const ARMED_MS = 4_000

/**
 * Ends an agent's session, confirming in place.
 *
 * The confirm is the button itself: one press arms it, a second ends the
 * session, and it disarms on its own after a few seconds or the moment focus
 * leaves. A dialog would be the heavier answer, and this already sits inside
 * one — stacking a second dialog on a preview to delete the thing the preview
 * is showing is how people end up clicking through confirms without reading
 * them.
 */
export function EndSessionButton({ onEnd }: { onEnd: () => void }): React.JSX.Element {
  const [armed, setArmed] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    if (!armed) {
      return
    }
    timer.current = setTimeout(() => setArmed(false), ARMED_MS)
    return () => clearTimeout(timer.current)
  }, [armed])

  return (
    <Button
      type="button"
      variant={armed ? 'destructive' : 'ghost'}
      size="xs"
      // Why: a destructive control that has armed itself must say so to a
      // screen reader too, not only by turning red.
      aria-label={
        armed
          ? translate('dashboardPopout.terminal.endSessionConfirm', 'Confirm ending this session')
          : translate('dashboardPopout.terminal.endSession', 'End session')
      }
      onBlur={() => setArmed(false)}
      onClick={() => {
        if (!armed) {
          setArmed(true)
          return
        }
        setArmed(false)
        onEnd()
      }}
    >
      <Trash2 className="size-3" />
      {armed
        ? translate('dashboardPopout.terminal.endSessionConfirmLabel', 'Delete?')
        : translate('dashboardPopout.terminal.endSessionLabel', 'End session')}
    </Button>
  )
}
