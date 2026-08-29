import { describe, expect, it } from 'vitest'
import {
  agentNotificationSituation,
  resolveNotificationSoundId
} from './agent-notification-situation'
import { getDefaultNotificationSettings } from './constants'

describe('agentNotificationSituation', () => {
  it('tells the four outcomes apart', () => {
    expect(agentNotificationSituation({ agentState: 'done' })).toBe('done')
    expect(agentNotificationSituation({ agentState: 'waiting' })).toBe('needs-input')
    expect(agentNotificationSituation({ agentState: 'blocked' })).toBe('needs-input')
    expect(agentNotificationSituation({ stalled: true, agentState: 'working' })).toBe('stuck')
    expect(agentNotificationSituation({ completionSource: 'process-exit' })).toBe('idle')
  })

  it('lets a question outrank the process exit that delivered it', () => {
    expect(
      agentNotificationSituation({ agentState: 'waiting', completionSource: 'process-exit' })
    ).toBe('needs-input')
  })
})

describe('resolveNotificationSoundId', () => {
  const settings = getDefaultNotificationSettings()

  it('gives each situation its own default when nothing was chosen', () => {
    expect(resolveNotificationSoundId(settings, 'done')).toBe('two-tone')
    expect(resolveNotificationSoundId(settings, 'needs-input')).toBe('ding')
    expect(resolveNotificationSoundId(settings, 'stuck')).toBe('bong')
    expect(resolveNotificationSoundId(settings, 'idle')).toBe('thump')
    // Without a situation (a terminal bell) the OS sound still applies.
    expect(resolveNotificationSoundId(settings)).toBe('system')
  })

  it('keeps an explicitly chosen single sound for every situation', () => {
    expect(resolveNotificationSoundId({ ...settings, customSoundId: 'ding' }, 'stuck')).toBe('ding')
    expect(resolveNotificationSoundId({ ...settings, customSoundId: 'ding' })).toBe('ding')
  })

  it('prefers the situation’s own sound', () => {
    const perSituation = {
      ...settings,
      customSoundId: 'ding' as const,
      soundIdBySituation: { stuck: 'bong' as const, 'needs-input': 'two-tone' as const }
    }
    expect(resolveNotificationSoundId(perSituation, 'stuck')).toBe('bong')
    expect(resolveNotificationSoundId(perSituation, 'needs-input')).toBe('two-tone')
    expect(resolveNotificationSoundId(perSituation, 'done')).toBe('ding')
  })

  it('treats a chosen custom file as the sound when no id was stored', () => {
    expect(
      resolveNotificationSoundId({
        customSoundId: undefined as never,
        customSoundPath: '/tmp/alert.mp3',
        soundIdBySituation: undefined
      })
    ).toBe('custom')
  })
})
