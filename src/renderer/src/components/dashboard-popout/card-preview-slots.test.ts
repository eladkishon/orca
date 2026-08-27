import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  MAX_LIVE_CARD_PREVIEWS,
  requestCardPreviewSlot,
  resetCardPreviewSlots
} from './card-preview-slots'

describe('requestCardPreviewSlot', () => {
  beforeEach(resetCardPreviewSlots)

  it('grants up to the cap and queues the rest', () => {
    const held = Array.from({ length: MAX_LIVE_CARD_PREVIEWS }, (_unused, index) =>
      requestCardPreviewSlot(`card-${index}`, () => {})
    )
    expect(held.every((slot) => slot.granted)).toBe(true)

    const onGranted = vi.fn()
    expect(requestCardPreviewSlot('overflow', onGranted).granted).toBe(false)
    expect(onGranted).not.toHaveBeenCalled()
  })

  it('hands a released slot to the next waiter', () => {
    const held = Array.from({ length: MAX_LIVE_CARD_PREVIEWS }, (_unused, index) =>
      requestCardPreviewSlot(`card-${index}`, () => {})
    )
    const onGranted = vi.fn()
    requestCardPreviewSlot('overflow', onGranted)

    held[0].release()

    expect(onGranted).toHaveBeenCalledTimes(1)
  })

  it('drops a still-waiting request on release, so it cannot be granted later', () => {
    const held = Array.from({ length: MAX_LIVE_CARD_PREVIEWS }, (_unused, index) =>
      requestCardPreviewSlot(`card-${index}`, () => {})
    )
    const onGranted = vi.fn()
    const waiting = requestCardPreviewSlot('overflow', onGranted)

    waiting.release()
    held[0].release()

    expect(onGranted).not.toHaveBeenCalled()
  })

  it('releases idempotently, so an unmount cannot free someone else’s slot', () => {
    const first = requestCardPreviewSlot('card-1', () => {})
    first.release()
    first.release()

    const others = Array.from({ length: MAX_LIVE_CARD_PREVIEWS }, (_unused, index) =>
      requestCardPreviewSlot(`other-${index}`, () => {})
    )
    expect(others.every((slot) => slot.granted)).toBe(true)
    expect(requestCardPreviewSlot('overflow', () => {}).granted).toBe(false)
  })
})
