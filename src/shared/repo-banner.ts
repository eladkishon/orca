import { validateRasterImageDataUri } from './image-data-uri'
import { isKnownRasterImageMimeType } from './raster-image-preview-limits'
import { MAX_REPO_ICON_DATA_URL_LENGTH } from './repo-icon'

/**
 * A project's banner behind its heading on the agent board.
 *
 * Two kinds, and the generated one is the default on purpose. Finding a picture
 * that reads as "this project" is work, and a board where every column looks
 * the same is the problem the banner exists to solve — so every project gets a
 * distinct generated banner from its own accent hue without anyone choosing
 * anything, and an image is the upgrade rather than the entry fee.
 *
 * A generated banner is a NAME, not pixels. It costs four bytes on a snapshot
 * republished several times a second, where an image costs up to 400KB, and it
 * stays sharp at any size.
 */

export const REPO_BANNER_VARIANTS = ['aurora', 'mesh', 'rays', 'tide', 'grain'] as const
export type RepoBannerVariant = (typeof REPO_BANNER_VARIANTS)[number]

export type RepoBanner =
  | { kind: 'generated'; variant: RepoBannerVariant }
  | { kind: 'image'; src: string; label?: string }

export const MAX_REPO_BANNER_DATA_URL_LENGTH = MAX_REPO_ICON_DATA_URL_LENGTH

const MAX_BANNER_LABEL_LENGTH = 200

function isRepoBannerVariant(value: unknown): value is RepoBannerVariant {
  return typeof value === 'string' && REPO_BANNER_VARIANTS.includes(value as RepoBannerVariant)
}

/**
 * Returns the banner only if Orca is willing to render it. An image must be a
 * RASTER data URL: the icon validator passes anything it does not recognise as
 * raster straight through, which is right for a favicon and wrong twice here —
 * a board of banners must fetch nothing, and `image/svg+xml` is not raster, so
 * it would arrive carrying whatever script it liked.
 */
export function sanitizeRepoBanner(value: unknown): RepoBanner | null {
  if (!value || typeof value !== 'object') {
    return null
  }
  const banner = value as { kind?: unknown; variant?: unknown; src?: unknown; label?: unknown }
  if (banner.kind === 'generated' || (banner.kind === undefined && banner.src === undefined)) {
    return isRepoBannerVariant(banner.variant)
      ? { kind: 'generated', variant: banner.variant }
      : null
  }
  if (typeof banner.src !== 'string' || banner.src.length > MAX_REPO_BANNER_DATA_URL_LENGTH) {
    return null
  }
  const mimeType = /^data:([^;,]+)/i.exec(banner.src)?.[1]
  if (!isKnownRasterImageMimeType(mimeType) || validateRasterImageDataUri(banner.src) === null) {
    return null
  }
  const label =
    typeof banner.label === 'string' && banner.label.trim()
      ? banner.label.trim().slice(0, MAX_BANNER_LABEL_LENGTH)
      : undefined
  return { kind: 'image', src: banner.src, ...(label ? { label } : {}) }
}

/**
 * The banner a project gets before anyone chooses one.
 *
 * Derived from the id so it is stable — a project that looked like this
 * yesterday looks like it today — and spread across the variants so adjacent
 * projects are unlikely to draw the same one.
 */
export function defaultRepoBannerVariant(projectId: string): RepoBannerVariant {
  let hash = 0x811c9dc5
  for (let index = 0; index < projectId.length; index += 1) {
    hash ^= projectId.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return REPO_BANNER_VARIANTS[(hash >>> 0) % REPO_BANNER_VARIANTS.length]
}
