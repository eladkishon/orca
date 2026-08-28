import type { AgentDotState } from '../worktree/agent-row-display'
import type { AgentCardPace } from './agent-card-pace'
import { colors } from '../theme/mobile-theme'

// The desktop board carries an agent's state on its card's RING, not on a dot
// (dashboard-popout/agent-card-state.css). Mobile draws the same thing: a 1px
// tinted border, a soft bloom behind it, and a breath while the agent is not
// settled. These are the dark-theme tones of that stylesheet.

const SKY = '#38bdf8'
const EMERALD = '#10b981'
const QUESTION = '#f97316'
const RED = '#ef4444'
const AMBER_SLOW = '#fbbf24'
const AMBER_STALLED = '#f59e0b'

export type AgentCardBreath = 'none' | 'breathing' | 'labouring'

export type AgentCardAppearance = {
  ring: string
  glow: string
  surface: string
  breath: AgentCardBreath
  /** How far the light dims at the bottom of a breath. 1 = no pulse. */
  dim: number
}

/** Completed agents stay green until acknowledged, then settle into gray idle. */
export function agentCardDisplayState(dotState: AgentDotState, unseen: boolean): AgentDotState {
  return dotState === 'done' && !unseen ? 'idle' : dotState
}

function stateAppearance(state: AgentDotState): AgentCardAppearance {
  switch (state) {
    case 'working':
      return {
        ring: SKY,
        glow: `${SKY}66`,
        surface: colors.bgPanel,
        breath: 'breathing',
        dim: 0.35
      }
    case 'monitoring':
      return { ring: SKY, glow: `${SKY}2e`, surface: colors.bgPanel, breath: 'none', dim: 1 }
    case 'waiting':
    case 'blocked':
      return {
        ring: QUESTION,
        glow: `${QUESTION}73`,
        surface: '#1d1611',
        breath: 'none',
        dim: 1
      }
    case 'done':
      return {
        ring: EMERALD,
        glow: `${EMERALD}4d`,
        surface: '#111a16',
        breath: 'breathing',
        dim: 0.4
      }
    case 'interrupted':
      return { ring: RED, glow: `${RED}4d`, surface: colors.bgPanel, breath: 'none', dim: 1 }
    default:
      // Neutral by default: an idle card should read as quiet, not as a state.
      return {
        ring: colors.borderSubtle,
        glow: 'transparent',
        surface: colors.bgPanel,
        breath: 'none',
        dim: 1
      }
  }
}

/**
 * Pace overrides the state's colour while an agent claims to be working: the
 * breath lengthens and warms, then stops. A still ring on a card that says it
 * is working is the thing worth spotting from across the board.
 */
export function agentCardAppearance(
  state: AgentDotState,
  pace: AgentCardPace
): AgentCardAppearance {
  const base = stateAppearance(state)
  if (pace === 'slow') {
    return {
      ring: AMBER_SLOW,
      glow: `${AMBER_SLOW}57`,
      surface: base.surface,
      breath: 'labouring',
      dim: 0.55
    }
  }
  if (pace === 'stalled') {
    return {
      ring: AMBER_STALLED,
      glow: `${AMBER_STALLED}61`,
      surface: '#1b1710',
      breath: 'none',
      dim: 1
    }
  }
  return base
}
