import {
  BellRing,
  CircleSlash,
  MessageCircleQuestion,
  PlugZap,
  type LucideIcon
} from 'lucide-react'
import { Label } from '../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { getNotificationSoundOptions } from '@/components/notification-sound-options'
import { resolveNotificationSoundId } from '../../../../shared/agent-notification-situation'
import { translate } from '@/i18n/i18n'
import {
  AGENT_NOTIFICATION_SITUATIONS,
  type AgentNotificationSituation
} from '../../../../shared/notification-settings-types'
import type { GlobalSettings } from '../../../../shared/global-settings-types'

/** The row has no sound of its own: it follows the default named beside it. */
export const MATCH_DEFAULT_SOUND_VALUE = 'match-default'

type SituationPresentation = { icon: LucideIcon; title: string; hint: string }

function situationPresentation(situation: AgentNotificationSituation): SituationPresentation {
  switch (situation) {
    case 'done':
      return {
        icon: BellRing,
        title: translate('settings.notifications.situation.done', 'Finished'),
        hint: translate(
          'settings.notifications.situation.doneHint',
          'The agent reported its work complete.'
        )
      }
    case 'needs-input':
      return {
        icon: MessageCircleQuestion,
        title: translate('settings.notifications.situation.needsInput', 'Needs you'),
        hint: translate(
          'settings.notifications.situation.needsInputHint',
          'The agent is waiting on an answer or a permission.'
        )
      }
    case 'stuck':
      return {
        icon: PlugZap,
        title: translate('settings.notifications.situation.stuck', 'Stuck'),
        hint: translate(
          'settings.notifications.situation.stuckHint',
          'It cannot proceed — logged out, offline, or rate limited.'
        )
      }
    case 'idle':
      return {
        icon: CircleSlash,
        title: translate('settings.notifications.situation.idle', 'Went idle'),
        hint: translate(
          'settings.notifications.situation.idleHint',
          'The session ended without a final report.'
        )
      }
  }
}

/**
 * A sound per outcome.
 *
 * One tone for everything says an agent moved but never which way, and the four
 * outcomes want different responses — so each takes its own sound, and a row
 * left on Default follows the single sound above it (or its own default when
 * that is the OS sound).
 */
export function AgentSituationSoundRows({
  notificationSettings,
  disabled,
  onSelect
}: {
  notificationSettings: GlobalSettings['notifications']
  disabled: boolean
  onSelect: (
    situation: AgentNotificationSituation,
    soundId: GlobalSettings['notifications']['customSoundId'] | null
  ) => Promise<void>
}): React.JSX.Element {
  const soundOptions = getNotificationSoundOptions(notificationSettings.customSoundPath)
  return (
    <div className="space-y-2 pt-1">
      <Label className="text-xs text-muted-foreground">
        {translate('settings.notifications.perSituation', 'Different sound per situation')}
      </Label>
      {AGENT_NOTIFICATION_SITUATIONS.map((situation) => {
        const { icon: Icon, title, hint } = situationPresentation(situation)
        const value = notificationSettings.soundIdBySituation?.[situation]
        // What this row plays when it has no sound of its own — the single
        // chosen sound, else this situation's default. Naming it beats "Same as
        // above", which stopped being true once the defaults differed.
        const fallbackId = resolveNotificationSoundId(
          { ...notificationSettings, soundIdBySituation: undefined },
          situation
        )
        const fallbackTitle =
          soundOptions.find((option) => option.id === fallbackId)?.title ?? fallbackId
        return (
          <div key={situation} className="flex items-center gap-3">
            <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium">{title}</div>
              <div className="truncate text-[11px] text-muted-foreground">{hint}</div>
            </div>
            <Select
              value={value ?? MATCH_DEFAULT_SOUND_VALUE}
              disabled={disabled}
              onValueChange={(next) =>
                void onSelect(
                  situation,
                  next === MATCH_DEFAULT_SOUND_VALUE
                    ? null
                    : (next as GlobalSettings['notifications']['customSoundId'])
                )
              }
            >
              <SelectTrigger className="w-[170px]" size="sm" aria-label={title}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value={MATCH_DEFAULT_SOUND_VALUE}>
                  {translate('settings.notifications.matchDefault', 'Default ({{sound}})', {
                    sound: fallbackTitle
                  })}
                </SelectItem>
                {soundOptions.map((option) => {
                  const OptionIcon = option.icon
                  return (
                    <SelectItem key={option.id} value={option.id}>
                      <OptionIcon className="size-4" />
                      <span className="truncate">{option.title}</span>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>
        )
      })}
    </div>
  )
}
