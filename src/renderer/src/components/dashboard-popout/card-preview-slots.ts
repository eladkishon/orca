/**
 * Rations live card previews.
 *
 * Every preview is a real PTY subscription plus an xterm parsing bytes, so a
 * board holding a large fleet must not open one per card. Slots are granted in
 * request order and handed to the next waiter on release; a card without one
 * keeps its static summary, which is what the board showed before.
 */

/** Chosen to cover a screenful of cards on a wide board, not the whole fleet. */
export const MAX_LIVE_CARD_PREVIEWS = 12

type Waiter = { key: string; onGranted: () => void }

let granted = new Set<string>()
const waiting: Waiter[] = []

function promoteWaiters(): void {
  while (granted.size < MAX_LIVE_CARD_PREVIEWS && waiting.length > 0) {
    const next = waiting.shift()
    if (!next || granted.has(next.key)) {
      continue
    }
    granted.add(next.key)
    next.onGranted()
  }
}

/**
 * Requests a preview slot for `key`. Returns whether it was granted
 * immediately; `onGranted` fires later if a slot frees up first. Always call
 * the returned release, granted or not — it also drops a pending request.
 */
export function requestCardPreviewSlot(
  key: string,
  onGranted: () => void
): { granted: boolean; release: () => void } {
  const release = (): void => {
    const pendingIndex = waiting.findIndex((waiter) => waiter.key === key)
    if (pendingIndex !== -1) {
      waiting.splice(pendingIndex, 1)
    }
    if (granted.delete(key)) {
      promoteWaiters()
    }
  }

  if (granted.has(key)) {
    return { granted: true, release }
  }
  if (granted.size < MAX_LIVE_CARD_PREVIEWS) {
    granted.add(key)
    return { granted: true, release }
  }
  waiting.push({ key, onGranted })
  return { granted: false, release }
}

/** Test seam: no production caller, since slots outlive any one board mount. */
export function resetCardPreviewSlots(): void {
  granted = new Set()
  waiting.length = 0
}
