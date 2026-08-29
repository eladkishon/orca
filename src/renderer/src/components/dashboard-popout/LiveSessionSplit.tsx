import { Fragment, useCallback } from 'react'
import { attachDividerDrag, disposeDividerDrag } from '@/lib/pane-manager/pane-divider-drag'
import { cn } from '@/lib/utils'

/**
 * Lays live session tiles out the way the terminal's own splits work: every
 * tile takes an equal share of the space it is given, and the gaps between them
 * are draggable. It reuses the pane divider's drag (same feel, same pointer
 * -capture handling), which resizes by writing `flex` onto its two DOM
 * siblings — so the children here are deliberately NOT given a React-managed
 * `style`, or the next render would snap a dragged layout back.
 */
export function LiveSessionSplit({
  direction,
  children,
  className
}: {
  direction: 'row' | 'column'
  children: readonly React.ReactNode[]
  className?: string
}): React.JSX.Element {
  const isVertical = direction === 'row'

  const setPaneRef = useCallback((element: HTMLDivElement | null) => {
    if (element && !element.style.flex) {
      element.style.flex = '1 1 0%'
    }
  }, [])

  const setDividerRef = useCallback(
    (element: HTMLDivElement | null) => {
      if (!element) {
        return
      }
      // The terminals refit themselves through their own ResizeObserver, so the
      // divider has nothing to refit on its behalf.
      attachDividerDrag(element, isVertical, { refitPanesUnder: () => {} })
      return () => disposeDividerDrag(element)
    },
    [isVertical]
  )

  return (
    <div className={cn('flex min-h-0 min-w-0', isVertical ? 'flex-row' : 'flex-col', className)}>
      {children.map((child, index) => (
        // Why a Fragment and not a wrapper: the divider resizes its DOM
        // SIBLINGS, so every pane and divider must be a direct child of the
        // flex container. Position is the key because the divider belongs to
        // the slot between two tiles, not to either card.
        <Fragment key={index}>
          {index > 0 ? (
            <div
              ref={setDividerRef}
              className={cn(
                'group/divider relative flex shrink-0 items-center justify-center',
                isVertical ? 'w-2.5 cursor-col-resize' : 'h-2.5 cursor-row-resize'
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'rounded-full bg-border transition-colors group-hover/divider:bg-foreground/40',
                  isVertical ? 'h-full w-px' : 'h-px w-full'
                )}
              />
            </div>
          ) : null}
          <div ref={setPaneRef} className="flex min-h-0 min-w-0 flex-col overflow-hidden">
            {child}
          </div>
        </Fragment>
      ))}
    </div>
  )
}
