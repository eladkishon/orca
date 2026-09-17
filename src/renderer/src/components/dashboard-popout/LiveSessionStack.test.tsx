// @vitest-environment happy-dom

import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LiveSessionStack, MIN_LIVE_TILE_HEIGHT } from './LiveSessionStack'

function dragHandle(handle: HTMLElement, byY: number): void {
  handle.setPointerCapture = () => {}
  handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientY: 0 }))
  handle.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientY: byY }))
  handle.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
}

describe('LiveSessionStack', () => {
  it('shares the column height until a tile is dragged, then pins only that tile', () => {
    const { container } = render(
      <LiveSessionStack>{[<span key="a">a</span>, <span key="b">b</span>]}</LiveSessionStack>
    )
    const tiles = [...container.querySelectorAll<HTMLElement>('[style*="flex"]')]
    const handles = [...container.querySelectorAll<HTMLElement>('[data-live-tile-resize-handle]')]
    const startHeight = 300
    expect(tiles[0]!.style.flex).toBe('1 1 0%')
    tiles.forEach((tile) => {
      tile.getBoundingClientRect = () => ({ height: startHeight }) as DOMRect
    })

    dragHandle(handles[0]!, 120)
    expect(tiles[0]!.style.flex).toBe(`0 0 ${startHeight + 120}px`)
    expect(tiles[1]!.style.flex).toBe('1 1 0%')

    dragHandle(handles[0]!, -1_000)
    expect(tiles[0]!.style.flex).toBe(`0 0 ${MIN_LIVE_TILE_HEIGHT}px`)
  })
})
