import { translate } from '@/i18n/i18n'

const ERROR_MESSAGES = {
  enterShareLink: [
    'auto.components.skills.install.enterShareLink',
    'Enter an Orca skill share link.'
  ],
  shareUnavailable: [
    'auto.components.skills.install.shareUnavailable',
    'This share is unavailable. The link may be invalid, expired, or revoked.'
  ],
  requestedVersionVerificationFailed: [
    'auto.components.skills.install.requestedVersionVerificationFailed',
    'Installation failed before Orca could verify the requested version.'
  ],
  reconnectBeforeInstalling: [
    'auto.components.skills.install.reconnectBeforeInstalling',
    'Reconnect your Orca account before installing.'
  ],
  destinationAlreadyFinished: [
    'auto.components.skills.install.destinationAlreadyFinished',
    'The destination had already finished this installation.'
  ],
  inspectManagedFailed: [
    'auto.components.skills.install.inspectManagedFailed',
    'Orca could not inspect managed installs on this machine.'
  ],
  reconnectForVersionHistory: [
    'auto.components.skills.install.reconnectForVersionHistory',
    'Reconnect your Orca account to load version history.'
  ],
  versionHistoryUnavailable: [
    'auto.components.skills.install.versionHistoryUnavailable',
    'Version history is unavailable for this skill.'
  ],
  bundleSkillsMissing: [
    'auto.components.skills.install.bundleSkillsMissing',
    'This version does not contain any of the installed bundle skills.'
  ],
  reconnectBeforeVersionChange: [
    'auto.components.skills.install.reconnectBeforeVersionChange',
    'Reconnect your Orca account before changing versions.'
  ],
  versionVerificationFailed: [
    'auto.components.skills.install.versionVerificationFailed',
    'Orca could not verify the requested version.'
  ],
  removeFailed: [
    'auto.components.skills.install.removeFailed',
    'Orca could not safely remove this skill.'
  ]
} as const

export function getSkillInstallErrorMessage(name: keyof typeof ERROR_MESSAGES): string {
  const [key, fallback] = ERROR_MESSAGES[name]
  return translate(key, fallback)
}
