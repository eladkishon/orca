import { AGENT_STALL_EPISODE_RESET_MS } from '../../../shared/agent-stall-recovery-policy'
import type { AgentStallObservation } from '../../../shared/agent-stall-recovery-policy'
import { resolveNotificationSoundId } from '../../../shared/agent-notification-situation'
import type { NotificationSettings } from '../../../shared/notification-settings-types'
import { playDesktopNotificationSound } from './desktop-notification-sound'

/**
 * The sound an agent makes when it gets stuck.
 *
 * A stalled agent is the one state nothing announced: it has not finished and
 * it is not asking anything, so no notification fires and the terminal just
 * goes quiet — which is indistinguishable from a long build until you look.
 * The stall detector already names the cause (logged out, offline, rate
 * limited); this gives that its own sound.
 *
 * Sound only, deliberately: a repainting TUI re-reports the same failure many
 * times a second, so this is an ear-level hint, not another OS banner.
 */
export type AgentStallSoundLedger = Map<string, { signature: string; soundedAt: number }>

/**
 * One sound per stall episode: the same failure repainting is not news, and a
 * pane that recovers and stalls again is.
 */
export function shouldSoundAgentStall(
  ledger: AgentStallSoundLedger,
  observation: Pick<AgentStallObservation, 'paneKey' | 'cause' | 'signature' | 'observedAt'>
): boolean {
  const key = `${observation.paneKey}:${observation.cause}`
  const previous = ledger.get(key)
  if (
    previous &&
    previous.signature === observation.signature &&
    observation.observedAt - previous.soundedAt < AGENT_STALL_EPISODE_RESET_MS
  ) {
    return false
  }
  ledger.set(key, { signature: observation.signature, soundedAt: observation.observedAt })
  return true
}

const stallSoundLedger: AgentStallSoundLedger = new Map()

/** Caps the ledger so a long-lived window tracking a churning fleet cannot grow without bound. */
const MAX_TRACKED_STALL_PANES = 200

export function playAgentStallSound(
  observation: Pick<AgentStallObservation, 'paneKey' | 'cause' | 'signature' | 'observedAt'>,
  settings: NotificationSettings | undefined
): void {
  if (!settings?.enabled) {
    return
  }
  if (!shouldSoundAgentStall(stallSoundLedger, observation)) {
    return
  }
  if (stallSoundLedger.size > MAX_TRACKED_STALL_PANES) {
    const oldest = stallSoundLedger.keys().next().value
    if (oldest) {
      stallSoundLedger.delete(oldest)
    }
  }
  void playDesktopNotificationSound(
    resolveNotificationSoundId(settings, 'stuck'),
    settings.customSoundVolume,
    'stuck'
  )
}
