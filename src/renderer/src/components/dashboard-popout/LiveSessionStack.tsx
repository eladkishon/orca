import { Fragment, useCallback } from 'react'
import { cn } from '@/lib/utils'

/** A live terminal is unreadable below this, so it is a floor rather than a
 *  share: a column of six sessions scrolls instead of shrinking to slivers. */
export const MIN_LIVE_TILE_HEIGHT = 220

/**
 * Stacks live session tiles so they share the column's height — one session
 * gets the whole screen, six hit the readable floor and the column scrolls.
 * Dragging a tile's bottom edge pins that tile to a fixed height; the ones
 * below keep sharing what is left, and no other column is touched.
 *
 * Heights are written straight to the DOM (never a React `style`) so a drag
 * survives the next snapshot render, the same reason LiveSessionSplit does it.
 */
export function LiveSessionStack({
  children,
  className
}: {
  children: readonly React.ReactNode[]
  className?: string
}): React.JSX.Element {
  const setTileRef = useCallback((element: HTMLDivElement | null) => {
    if (element && !element.style.flex) {
      element.style.flex = '1 1 0%'
    }
  }, [])

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const handle = event.currentTarget
    const tile = handle.previousElementSibling
    if (!(tile instanceof HTMLElement) || event.button !== 0) {
      return
    }
    event.preventDefault()
    const startY = event.clientY
    const startHeight = tile.getBoundingClientRect().height
    handle.setPointerCapture(event.pointerId)
    const resize = (move: PointerEvent): void => {
      // Pinned rather than resized: a dragged tile stops sharing the column.
      tile.style.flex = `0 0 ${Math.max(MIN_LIVE_TILE_HEIGHT, startHeight + move.clientY - startY)}px`
    }
    const stop = (): void => {
      handle.removeEventListener('pointermove', resize)
      handle.removeEventListener('pointerup', stop)
      handle.removeEventListener('pointercancel', stop)
    }
    handle.addEventListener('pointermove', resize)
    handle.addEventListener('pointerup', stop)
    handle.addEventListener('pointercancel', stop)
  }, [])

  return (
    <div className={cn('flex flex-col', className)}>
      {children.map((child, index) => (
        // Why the handle is a sibling: it resizes the tile before it in the
        // DOM, so it belongs to that tile's bottom edge and not inside it.
        <Fragment key={index}>
          <div
            ref={setTileRef}
            style={{ minHeight: MIN_LIVE_TILE_HEIGHT }}
            className="flex flex-col overflow-hidden"
          >
            {child}
          </div>
          <div
            onPointerDown={handlePointerDown}
            data-live-tile-resize-handle="true"
            className="group/divider relative flex h-2.5 shrink-0 cursor-row-resize items-center justify-center"
          >
            <span
              aria-hidden
              className="h-px w-full rounded-full bg-border transition-colors group-hover/divider:bg-foreground/40"
            />
          </div>
        </Fragment>
      ))}
    </div>
  )
}
