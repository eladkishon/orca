import type { AgentNotificationSituation } from '../../shared/notification-settings-types'
import { ipcRenderer } from 'electron'
import type {
  NotificationDeliveryProbeResult,
  NotificationDismissResult,
  NotificationDispatchResult,
  NotificationPermissionStatusResult,
  NotificationSoundDataResult,
  NotificationSoundPathResult,
  NotificationSoundResult
} from '../../shared/notification-settings-types'
import type { PreloadApi } from '../api-types'

// Why a map and not one slot: per-situation sounds alternate (done, then
// needs-input), and a single slot would reload a file on every alternation.
const cachedNotificationSounds = new Map<string, { blobUrl: string; audio: HTMLAudioElement }>()
const MAX_CACHED_NOTIFICATION_SOUNDS = 5
let isNotificationSoundPlaying = false
// Why: audio.play() can reject before ended/error fires; cleanup prevents leaked listeners.
let cleanupNotificationSoundPlayback: (() => void) | null = null

function clearNotificationSoundPlaybackState(): void {
  cleanupNotificationSoundPlayback?.()
  cleanupNotificationSoundPlayback = null
  isNotificationSoundPlaying = false
}

function disposeCachedNotificationSoundAtPath(path: string): void {
  const entry = cachedNotificationSounds.get(path)
  if (!entry) {
    return
  }
  entry.audio.pause()
  entry.audio.src = ''
  URL.revokeObjectURL(entry.blobUrl)
  cachedNotificationSounds.delete(path)
}

function disposeCachedNotificationSound(): void {
  if (cachedNotificationSounds.size === 0) {
    return
  }
  clearNotificationSoundPlaybackState()
  for (const path of Array.from(cachedNotificationSounds.keys())) {
    disposeCachedNotificationSoundAtPath(path)
  }
}

export const notificationsApi = {
  dispatch: (args: Record<string, unknown>): Promise<NotificationDispatchResult> =>
    ipcRenderer.invoke('notifications:dispatch', args),
  dismiss: (ids: string[]): Promise<NotificationDismissResult> =>
    ipcRenderer.invoke('notifications:dismiss', ids),
  openSystemSettings: (): Promise<void> => ipcRenderer.invoke('notifications:openSystemSettings'),
  getPermissionStatus: (): Promise<NotificationPermissionStatusResult> =>
    ipcRenderer.invoke('notifications:getPermissionStatus'),
  probeDelivery: (args?: { force?: boolean }): Promise<NotificationDeliveryProbeResult> =>
    ipcRenderer.invoke('notifications:probeDelivery', args),
  playSound: async (options?: {
    force?: boolean
    volume?: number
    /** Which of the agent's outcomes this is, so it can have its own sound. */
    situation?: AgentNotificationSituation
  }): Promise<NotificationSoundResult> => {
    try {
      // Why: drop replays while still ringing; the test button passes force to always confirm.
      if (!options?.force && isNotificationSoundPlaying) {
        return { played: false, reason: 'deduped' }
      }

      const resolved = (await ipcRenderer.invoke('notifications:resolveSoundPath', {
        situation: options?.situation
      })) as NotificationSoundPathResult
      if (!resolved.ok) {
        disposeCachedNotificationSound()
        return { played: false, reason: resolved.reason }
      }

      let entry = cachedNotificationSounds.get(resolved.path)
      if (!entry) {
        const sound = (await ipcRenderer.invoke('notifications:loadSound', {
          situation: options?.situation
        })) as NotificationSoundDataResult
        if (!sound.ok) {
          disposeCachedNotificationSound()
          return { played: false, reason: sound.reason }
        }
        const arrayBuffer = new ArrayBuffer(sound.data.byteLength)
        new Uint8Array(arrayBuffer).set(sound.data)
        const blob = new Blob([arrayBuffer], { type: sound.mimeType })
        const blobUrl = URL.createObjectURL(blob)
        entry = { blobUrl, audio: new Audio(blobUrl) }
        cachedNotificationSounds.set(sound.path, entry)
        // Oldest first, so the cap evicts the sound heard longest ago.
        while (cachedNotificationSounds.size > MAX_CACHED_NOTIFICATION_SOUNDS) {
          const oldest = cachedNotificationSounds.keys().next().value
          if (!oldest) {
            break
          }
          disposeCachedNotificationSoundAtPath(oldest)
        }
      }

      const audio = entry.audio
      // Why: restart from zero on each play so bursts replay instead of stacking copies (GNOME canberra / VS Code signal service).
      audio.currentTime = 0
      if (typeof options?.volume === 'number' && Number.isFinite(options.volume)) {
        audio.volume = Math.min(1, Math.max(0, options.volume / 100))
      }
      isNotificationSoundPlaying = true
      cleanupNotificationSoundPlayback?.()
      const release = (): void => {
        cleanup()
        if (cleanupNotificationSoundPlayback === cleanup) {
          cleanupNotificationSoundPlayback = null
        }
        isNotificationSoundPlaying = false
      }
      const cleanup = (): void => {
        audio.removeEventListener('ended', release)
        audio.removeEventListener('error', release)
      }
      cleanupNotificationSoundPlayback = cleanup
      audio.addEventListener('ended', release)
      audio.addEventListener('error', release)
      try {
        await audio.play()
      } catch {
        release()
        return { played: false, reason: 'playback-failed' }
      }
      return { played: true }
    } catch {
      clearNotificationSoundPlaybackState()
      return { played: false, reason: 'playback-failed' }
    }
  }
} satisfies PreloadApi['notifications']
