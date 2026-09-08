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
  it('resizes only the tile above the handle and never below the readable floor', () => {
    const { container } = render(
      <LiveSessionStack>{[<span key="a">a</span>, <span key="b">b</span>]}</LiveSessionStack>
    )
    const tiles = [...container.querySelectorAll<HTMLElement>('[style*="height"]')]
    const handles = [...container.querySelectorAll<HTMLElement>('[data-live-tile-resize-handle]')]
    const startHeight = Number.parseInt(tiles[0]!.style.height, 10)
    tiles.forEach((tile) => {
      tile.getBoundingClientRect = () => ({ height: startHeight }) as DOMRect
    })

    dragHandle(handles[0]!, 120)
    expect(tiles[0]!.style.height).toBe(`${startHeight + 120}px`)
    expect(tiles[1]!.style.height).toBe(`${startHeight}px`)

    dragHandle(handles[0]!, -1_000)
    expect(tiles[0]!.style.height).toBe(`${MIN_LIVE_TILE_HEIGHT}px`)
  })
})
