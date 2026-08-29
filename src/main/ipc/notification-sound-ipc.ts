import { ipcMain } from 'electron'
import { readFile, stat } from 'node:fs/promises'
import { extname, normalize } from 'node:path'
import type { Store } from '../persistence'
import {
  AGENT_NOTIFICATION_SITUATIONS,
  type AgentNotificationSituation,
  type NotificationSoundDataResult
} from '../../shared/notification-settings-types'
import {
  getSelectedNotificationSoundPath,
  NOTIFICATION_SOUND_MIME_BY_EXTENSION
} from './notification-sound-selection'

const MAX_NOTIFICATION_SOUND_BYTES = 10 * 1024 * 1024

/** Untrusted renderer input: anything but a known situation means "no situation". */
function readSituation(args: unknown): AgentNotificationSituation | undefined {
  const situation = (args as { situation?: unknown } | undefined)?.situation
  return AGENT_NOTIFICATION_SITUATIONS.includes(situation as AgentNotificationSituation)
    ? (situation as AgentNotificationSituation)
    : undefined
}

export function registerNotificationSoundHandlers(store: Store): void {
  // Why: return the path so the preload's path-keyed cache skips the 10MB IPC round-trip on repeat dispatches.
  ipcMain.removeHandler('notifications:resolveSoundPath')
  ipcMain.handle(
    'notifications:resolveSoundPath',
    (
      _event,
      args?: { situation?: string }
    ):
      | { ok: true; path: string }
      | { ok: false; reason: 'missing-path' | 'invalid-path' | 'unsupported-type' } => {
      const selectedSound = getSelectedNotificationSoundPath(
        store.getSettings().notifications,
        readSituation(args)
      )
      if (!selectedSound.path) {
        return { ok: false, reason: selectedSound.reason ?? 'missing-path' }
      }
      const normalizedPath = normalize(selectedSound.path)
      if (!NOTIFICATION_SOUND_MIME_BY_EXTENSION.has(extname(normalizedPath).toLowerCase())) {
        return { ok: false, reason: 'unsupported-type' }
      }
      return { ok: true, path: normalizedPath }
    }
  )

  ipcMain.removeHandler('notifications:loadSound')
  ipcMain.handle(
    'notifications:loadSound',
    async (_event, args?: { situation?: string }): Promise<NotificationSoundDataResult> => {
      const selectedSound = getSelectedNotificationSoundPath(
        store.getSettings().notifications,
        readSituation(args)
      )
      if (!selectedSound.path) {
        return { ok: false, reason: selectedSound.reason ?? 'missing-path' }
      }

      const normalizedPath = normalize(selectedSound.path)

      const mimeType = NOTIFICATION_SOUND_MIME_BY_EXTENSION.get(
        extname(normalizedPath).toLowerCase()
      )
      if (!mimeType) {
        return { ok: false, reason: 'unsupported-type' }
      }

      try {
        const fileStat = await stat(normalizedPath)
        if (!fileStat.isFile()) {
          return { ok: false, reason: 'invalid-path' }
        }
        if (fileStat.size > MAX_NOTIFICATION_SOUND_BYTES) {
          return { ok: false, reason: 'too-large' }
        }

        const data = await readFile(normalizedPath)
        return { ok: true, data: new Uint8Array(data), mimeType, path: normalizedPath }
      } catch {
        return { ok: false, reason: 'read-failed' }
      }
    }
  )
}
