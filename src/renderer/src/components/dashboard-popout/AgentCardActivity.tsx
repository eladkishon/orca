import { useEffect, useRef, useState } from 'react'
import { agentTerminalActivityTail } from '../../../../shared/agent-terminal-activity-tail'
import { requestCardPreviewSlot } from './card-preview-slots'
import { cn } from '@/lib/utils'

/** Enough to say what is happening without turning the card into a pane. */
const ACTIVITY_LINES = 3
/** More than the tail can use; keeps a redraw-heavy TUI from growing the buffer. */
const MAX_BUFFERED_CHARS = 64 * 1024
/** A busy agent repaints many times a second; the card only needs to keep up. */
const REFRESH_MS = 500

/**
 * The readable last few lines of what an agent is doing, on its board card.
 *
 * Not a terminal: the card shows the agent's words, with the TUI frame,
 * spinners and in-place redraws taken out (see agentTerminalActivityTail).
 * That also means no xterm per card — this reads the stream as text.
 *
 * It never calls `terminalPreview.fit`. That claims the PTY grid and resizes
 * the agent's real terminal to the caller's box, which from a card would
 * reshape every previewed agent's pane at once.
 */
export function AgentCardActivity({
  ptyId,
  className
}: {
  ptyId: string
  className?: string
}): React.JSX.Element | null {
  const boxRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [hasSlot, setHasSlot] = useState(false)
  const [lines, setLines] = useState<string[]>([])

  // Why: a board can hold hundreds of cards and show a dozen. An off-screen
  // card is not worth a PTY subscription, and the slot pool caps even the
  // visible ones so a fast scroll cannot open one per card it passes.
  useEffect(() => {
    const box = boxRef.current
    if (!box) {
      return
    }
    const observer = new IntersectionObserver(
      (entries) => setVisible(entries.some((entry) => entry.isIntersecting)),
      { rootMargin: '80px' }
    )
    observer.observe(box)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!visible) {
      setHasSlot(false)
      return
    }
    const slot = requestCardPreviewSlot(ptyId, () => setHasSlot(true))
    setHasSlot(slot.granted)
    return () => {
      slot.release()
      setHasSlot(false)
    }
  }, [ptyId, visible])

  useEffect(() => {
    if (!hasSlot) {
      setLines([])
      return
    }
    let disposed = false
    let buffer = ''
    let rendered = ''

    const append = (chunk: string): void => {
      buffer += chunk
      if (buffer.length > MAX_BUFFERED_CHARS) {
        buffer = buffer.slice(buffer.length - MAX_BUFFERED_CHARS)
      }
    }

    // Why: the agent repaints far faster than anyone reads. Recomputing on a
    // tick instead of per chunk keeps a chatty pane from re-rendering the whole
    // board, and the string compare keeps an unchanged screen from doing so.
    const refresh = (): void => {
      if (disposed) {
        return
      }
      const tail = agentTerminalActivityTail(buffer, ACTIVITY_LINES)
      const joined = tail.join('\n')
      if (joined !== rendered) {
        rendered = joined
        setLines(tail)
      }
    }
    const timer = setInterval(refresh, REFRESH_MS)

    const offData = window.api.terminalPreview.onData((payload) => {
      if (payload.ptyId !== ptyId || disposed || payload.type === 'resync') {
        return
      }
      append(payload.data)
      void window.api.terminalPreview.ack(ptyId, payload.bytes)
    })

    void window.api.terminalPreview
      .connect(ptyId, { scrollbackRows: ACTIVITY_LINES * 4 })
      .then((connection) => {
        if (disposed) {
          return
        }
        if (connection.snapshot) {
          append(connection.snapshot.scrollbackAnsi ?? '')
          append(connection.snapshot.data)
        }
        for (const chunk of connection.replay) {
          append(chunk.data)
        }
        refresh()
      })
      .catch(() => undefined)

    return () => {
      disposed = true
      clearInterval(timer)
      offData()
      void window.api.terminalPreview.unsubscribe(ptyId)
    }
  }, [hasSlot, ptyId])

  return (
    <div ref={boxRef} className={cn('min-h-[1rem]', className)}>
      {lines.length > 0 ? (
        <div className="flex flex-col gap-px rounded-md bg-muted/40 px-1.5 py-1">
          {lines.map((line, index) => (
            <span
              key={`${index}-${line}`}
              className={cn(
                'truncate font-mono text-[10px] leading-snug',
                // The newest line is what the agent is doing now; the ones
                // above it are context, so they recede.
                index === lines.length - 1 ? 'text-foreground/80' : 'text-muted-foreground/70'
              )}
            >
              {line}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}
