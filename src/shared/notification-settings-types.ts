import type { AgentStatusState, AgentType } from './agent-status-types'

export type NotificationSoundId =
  | 'system'
  | 'two-tone'
  | 'bong'
  | 'thump'
  | 'blip'
  | 'sonar'
  | 'blop'
  | 'ding'
  | 'clack'
  | 'beep'
  | 'custom'

/**
 * What just happened to an agent, for the ear.
 *
 * The four are worth telling apart without looking: `done` is news you can act
 * on, `needs-input` is the agent waiting on YOU, `stuck` is an agent that
 * cannot proceed (logged out, offline, rate limited), and `idle` is a session
 * that ended without a report.
 */
export const AGENT_NOTIFICATION_SITUATIONS = ['done', 'needs-input', 'stuck', 'idle'] as const
export type AgentNotificationSituation = (typeof AGENT_NOTIFICATION_SITUATIONS)[number]

export type NotificationSettings = {
  enabled: boolean
  agentTaskComplete: boolean
  terminalBell: boolean
  suppressWhenFocused: boolean
  customSoundId: NotificationSoundId
  /** Per-situation sound. A situation without one falls back to `customSoundId`,
   *  so an install that never opens this setting keeps its single sound. */
  soundIdBySituation?: Partial<Record<AgentNotificationSituation, NotificationSoundId>>
  customSoundPath: string | null
  customSoundVolume: number
}

export type NotificationEventSource = 'agent-task-complete' | 'terminal-bell' | 'test'

export type NotificationDispatchRequest = {
  source: NotificationEventSource
  notificationId?: string
  /** Why: useful for fast native failures, but macOS can still drop notifications after 'show'. */
  requireDisplayConfirmation?: boolean
  worktreeId?: string
  /** Stable `${tabId}:${leafId}` terminal pane key for click-to-focus routing. */
  paneKey?: string
  repoLabel?: string
  worktreeLabel?: string
  hasMultipleActiveRepos?: boolean
  terminalTitle?: string
  isActiveWorktree?: boolean
  agentType?: AgentType
  agentState?: AgentStatusState
  agentPrompt?: string
  agentToolName?: string
  agentToolInput?: string
  agentLastAssistantMessage?: string
  agentInterrupted?: boolean
  /** Which sound this event should make; also decides whether the OS plays its own. */
  situation?: AgentNotificationSituation
}

export type NotificationDispatchResult = {
  delivered: boolean
  /** Why delivery was skipped (set when delivered is false); 'blocked-by-system' = macOS would silently swallow it. */
  reason?:
    | 'disabled'
    | 'source-disabled'
    | 'suppressed-focus'
    | 'cooldown'
    | 'not-supported'
    | 'not-displayed'
    | 'blocked-by-system'
    | 'invalid-request'
}

export type NotificationDismissResult = {
  dismissed: number
}

export type NotificationSoundResult = {
  played: boolean
  reason?:
    | 'missing-path'
    | 'invalid-path'
    | 'unsupported-type'
    | 'too-large'
    | 'read-failed'
    | 'playback-failed'
    | 'deduped'
}

export type NotificationSoundDataResult =
  | {
      ok: true
      data: Uint8Array
      mimeType: string
      path: string
    }
  | {
      ok: false
      reason: Exclude<NotificationSoundResult['reason'], 'playback-failed'>
    }

export type NotificationSoundPathResult =
  | { ok: true; path: string }
  | { ok: false; reason: 'missing-path' | 'invalid-path' | 'unsupported-type' }

export type NotificationPermissionStatusResult = {
  supported: boolean
  platform: NodeJS.Platform
  requested: boolean
}

/** macOS notification permission outcome: authoritative native UNUserNotificationCenter readout, else a weaker
 *  delivery-probe fallback; 'awaiting-decision' = permission dialog unanswered. */
export type NotificationDeliveryProbeResult = {
  state: 'delivered' | 'blocked' | 'awaiting-decision' | 'unsupported'
  /** True when the state comes from the native authorization readout (vs. the delivery-probe fallback). */
  authoritative: boolean
}
