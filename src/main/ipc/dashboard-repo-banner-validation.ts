/**
 * Admits the project banner images a dashboard snapshot carries.
 *
 * Its own module because the verdict has to be cached: banners are data URLs
 * republished with every snapshot, so sanitising one would cost a base64 decode
 * several times a second, for every project on the board.
 */

import { BoundedMap } from '../../shared/bounded-map'
import { sanitizeRepoBanner } from '../../shared/repo-banner'
import { isBoundedString, MAX_ID_LENGTH } from './dashboard-payload-primitives'

const MAX_DASHBOARD_REPO_BANNERS = 500
const MAX_CACHED_BANNER_SRC_BYTES = 8 * 1024 * 1024

const bannerValidity = new BoundedMap<string, boolean>({
  maxEntries: MAX_DASHBOARD_REPO_BANNERS,
  maxBytes: MAX_CACHED_BANNER_SRC_BYTES,
  sizeOf: (_valid, key) => key.length * 2
})

export function isDashboardRepoBanners(value: unknown): boolean {
  if (value === undefined) {
    return true
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }
  const entries = Object.entries(value as Record<string, unknown>)
  return (
    entries.length <= MAX_DASHBOARD_REPO_BANNERS &&
    entries.every(([repoId, banner]) => {
      if (!isBoundedString(repoId, MAX_ID_LENGTH)) {
        return false
      }
      const src = (banner as { src?: unknown } | null)?.src
      // Why only images are cached: a generated banner is a short name, so
      // checking it costs nothing, and it has no src to key a cache by.
      if (typeof src !== 'string') {
        return sanitizeRepoBanner(banner) !== null
      }
      const cached = bannerValidity.get(src)
      if (cached !== undefined) {
        return cached
      }
      const valid = sanitizeRepoBanner(banner) !== null
      bannerValidity.set(src, valid)
      return valid
    })
  )
}
