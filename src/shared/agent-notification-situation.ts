import type { AgentStatusState } from './agent-status-types'
import type {
  AgentNotificationSituation,
  NotificationSettings,
  NotificationSoundId
} from './notification-settings-types'

/**
 * Which sound a notification should make.
 *
 * One tone for every event means the room tells you an agent moved, but never
 * which way it moved — and the four outcomes want very different responses:
 * finished work wants a look, a question wants an answer now, a stuck agent
 * wants a fix, and a session that just ended wants nothing at all. The state
 * the notification already carries is enough to tell them apart, so nothing new
 * has to be measured for this.
 */
export function agentNotificationSituation(input: {
  agentState?: AgentStatusState
  /** True for a stall the detector named (logged out, network, rate limited). */
  stalled?: boolean
  /** Set when the notification came from the agent's process exiting. */
  completionSource?: string
}): AgentNotificationSituation {
  if (input.stalled) {
    return 'stuck'
  }
  if (input.agentState === 'waiting' || input.agentState === 'blocked') {
    return 'needs-input'
  }
  // Why: an agent whose process exited stopped rather than reported; the board
  // reads that row as idle, and the ear should hear the same thing.
  if (input.completionSource === 'process-exit') {
    return 'idle'
  }
  return 'done'
}

/**
 * What each outcome sounds like when nobody has chosen.
 *
 * Chosen to be told apart by ear alone rather than to be pleasant in isolation:
 * a two-tone rise for finished, a bright ding for a question, a low bong for
 * stuck, and a dull thump for a session that just stopped.
 */
export const DEFAULT_SITUATION_SOUND: Readonly<
  Record<AgentNotificationSituation, NotificationSoundId>
> = {
  done: 'two-tone',
  'needs-input': 'ding',
  stuck: 'bong',
  idle: 'thump'
}

/**
 * The sound for a situation, in order: the situation's own choice, then a
 * single sound the user explicitly picked for everything, then this
 * situation's default.
 *
 * The middle rung is what keeps an explicit choice explicit — someone who set
 * every notification to Blop meant it, and must not be talked out of it by a
 * default that knows better.
 */
export function resolveNotificationSoundId(
  settings: Pick<NotificationSettings, 'customSoundId' | 'soundIdBySituation' | 'customSoundPath'>,
  situation?: AgentNotificationSituation
): NotificationSoundId {
  const perSituation = situation ? settings.soundIdBySituation?.[situation] : undefined
  if (perSituation) {
    return perSituation
  }
  const chosen = settings.customSoundId ?? (settings.customSoundPath ? 'custom' : 'system')
  if (chosen !== 'system') {
    return chosen
  }
  return situation ? DEFAULT_SITUATION_SOUND[situation] : chosen
}
