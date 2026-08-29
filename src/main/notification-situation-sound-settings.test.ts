import { describe, expect, it } from 'vitest'
import {
  normalizeNotificationSettings,
  persistedNotificationSettingsRepaired
} from './persistence/applying-settings/onboarding-normalization'
import { getEffectiveNotificationSoundId } from './ipc/notification-sound-selection'
import { getDefaultNotificationSettings } from '../shared/constants'

describe('normalizeNotificationSettings — per-situation sounds', () => {
  it('keeps known situations and drops everything else', () => {
    const normalized = normalizeNotificationSettings({
      ...getDefaultNotificationSettings(),
      soundIdBySituation: {
        stuck: 'bong',
        'needs-input': 'two-tone',
        idle: 'not-a-sound',
        nonsense: 'ding'
      }
    })
    expect(normalized.soundIdBySituation).toEqual({ 'needs-input': 'two-tone', stuck: 'bong' })
  })

  it('omits the map entirely when nothing survives, so the single sound still applies', () => {
    const normalized = normalizeNotificationSettings({
      ...getDefaultNotificationSettings(),
      soundIdBySituation: { stuck: 42 }
    })
    expect(normalized.soundIdBySituation).toBeUndefined()
    // Falls through to the situation's default rather than the OS sound.
    expect(getEffectiveNotificationSoundId(normalized, 'stuck')).toBe('bong')
  })

  it('does not report a repair for a map it left untouched', () => {
    const persisted = {
      ...getDefaultNotificationSettings(),
      soundIdBySituation: { stuck: 'bong' }
    }
    const normalized = normalizeNotificationSettings(persisted)
    expect(persistedNotificationSettingsRepaired(persisted, normalized)).toBe(false)
  })
})

describe('getEffectiveNotificationSoundId', () => {
  it('answers per situation, falling back to the single sound', () => {
    const settings = normalizeNotificationSettings({
      ...getDefaultNotificationSettings(),
      customSoundId: 'ding',
      soundIdBySituation: { stuck: 'bong' }
    })
    expect(getEffectiveNotificationSoundId(settings, 'stuck')).toBe('bong')
    expect(getEffectiveNotificationSoundId(settings, 'done')).toBe('ding')
    expect(getEffectiveNotificationSoundId(settings)).toBe('ding')
  })
})
