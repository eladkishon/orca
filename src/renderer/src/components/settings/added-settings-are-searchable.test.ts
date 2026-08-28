import { describe, expect, it } from 'vitest'
import { getAccountsPaneSearchEntries } from './accounts-search'
import { getRepositoryPaneSearchEntries } from './repository-search'
import { matchesSettingsSearch } from './settings-search'
import type { Repo } from '../../../../shared/repo-types'

/**
 * A setting nobody can find is a setting nobody has. The matcher tests the
 * WHOLE query as a substring of one field, so a two-word phrase only matches if
 * some field literally contains it — which is exactly how these shipped
 * unfindable the first time.
 */

const repo = {
  id: 'r1',
  path: '/repo',
  displayName: 'Repo',
  badgeColor: '#fff',
  addedAt: 1,
  kind: 'git'
} as Repo

describe('settings search reaches the settings people look for', () => {
  it('finds the usage-limit account fallback by the words a user would type', () => {
    const entries = getAccountsPaneSearchEntries()
    for (const query of [
      'usage',
      'usage limit',
      'rate limit',
      'quota',
      'switch account',
      'switch accounts',
      'auto switch',
      'fallback'
    ]) {
      expect([query, matchesSettingsSearch(query, entries)]).toEqual([query, true])
    }
  })

  it('finds the project board banner', () => {
    const entries = getRepositoryPaneSearchEntries(repo)
    for (const query of ['banner', 'board banner', 'project banner', 'banner image']) {
      expect([query, matchesSettingsSearch(query, entries)]).toEqual([query, true])
    }
  })
})
