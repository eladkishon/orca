import { translate } from '@/i18n/i18n'
import { searchKeywords } from './settings-search-keywords'

const AGENT_STALL_RECOVERY_TITLE_KEY =
  'auto.components.settings.agent-stall-recovery-copy.50ce4fca77'
const AGENT_STALL_RECOVERY_DESCRIPTION_KEY =
  'auto.components.settings.agent-stall-recovery-copy.26c50479c3'

export function getAgentStallRecoveryTitle(): string {
  return translate(AGENT_STALL_RECOVERY_TITLE_KEY, 'Auto-continue stalled agents')
}

export function getAgentStallRecoveryDescription(): string {
  return translate(
    AGENT_STALL_RECOVERY_DESCRIPTION_KEY,
    'When an agent stops on a login or network failure, Orca resumes it and every other stalled agent in the same conversation. Backs off and gives up instead of restarting in a loop.'
  )
}

export function getAgentStallRecoverySearchKeywords(): string[] {
  return searchKeywords([
    { key: 'auto.components.settings.agents.search.a2d0a4b9c1', fallback: 'stalled' },
    { key: 'auto.components.settings.agents.search.b7e1f0c4d2', fallback: 'stuck' },
    { key: 'auto.components.settings.agents.search.c3f2a1b5e6', fallback: 'resume' },
    { key: 'auto.components.settings.agents.search.d4a3b2c6f7', fallback: 'continue' },
    { key: 'auto.components.settings.agents.search.e5b4c3d7a8', fallback: 'restart' },
    { key: 'auto.components.settings.agents.search.f6c5d4e8b9', fallback: 'login' },
    { key: 'auto.components.settings.agents.search.a7d6e5f9c0', fallback: 'network' },
    { key: 'auto.components.settings.agents.search.b8e7f6a0d1', fallback: 'recovery' }
  ])
}
