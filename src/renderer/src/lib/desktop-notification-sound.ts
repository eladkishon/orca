import type { AgentNotificationSituation } from '../../../shared/notification-settings-types'

export async function playDesktopNotificationSound(
  customSoundId: string | null | undefined,
  customSoundVolume?: number | null,
  /** Picks the situation's own sound; main falls back to the global one. */
  situation?: AgentNotificationSituation
): Promise<boolean> {
  if (!customSoundId || customSoundId === 'system') {
    return false
  }

  try {
    const result = await window.api.notifications.playSound({
      volume: customSoundVolume ?? undefined,
      ...(situation ? { situation } : {})
    })
    // Why: 'deduped' is expected when bursts of notifications coalesce — not a failure.
    if (!result.played && result.reason !== 'deduped') {
      console.warn('Failed to play custom notification sound:', result.reason)
    }
    return result.played
  } catch (err) {
    console.warn('Failed to play custom notification sound:', err)
    return false
  }
}
