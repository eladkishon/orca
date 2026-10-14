import type { AgentDashboardMode } from './ui-chrome-types'

/** Agent Dashboard and fleet-recovery settings, split out of GlobalSettings to keep that file
 *  under its line budget. */
export type AgentFleetSettings = {
  /** How the Agent Dashboard opens: an in-window companion board or a separate pop-out window. Defaults to in-window. */
  experimentalAgentDashboardMode?: AgentDashboardMode
  /** Includes stale quiet agents as a fourth Agent Dashboard column. */
  experimentalAgentDashboardShowIdle?: boolean
  /** On unless explicitly disabled: continue agents that stalled on a login or
   *  network failure, fleet-wide. Optional for legacy settings files. */
  autoRecoverStalledAgents?: boolean
  /** Minutes of silence before a working agent's card is called stalled.
   *  0 turns the stall treatment off entirely. Defaults to 3. */
  experimentalAgentDashboardStallMinutes?: number
  /** When a session hits its provider usage limit, move to another managed
   *  account of that provider and continue the agents the limit stopped.
   *  Off by default: it spends a second account's quota without asking. */
  autoSwitchAccountOnUsageLimit?: boolean
  /** API key for Gemini image generation (AI banner suggestions). Stored encrypted. */
  geminiApiKey: string
}
