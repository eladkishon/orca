import { validateRasterImageDataUri } from './image-data-uri'
import { isKnownRasterImageMimeType } from './raster-image-preview-limits'
import { MAX_REPO_ICON_DATA_URL_LENGTH } from './repo-icon'

/**
 * A project's banner image, shown behind its heading on the agent board.
 *
 * Separate from `repoIcon` on purpose: an icon identifies a project in a 16px
 * box and a banner sets the tone of a whole column, so they are different
 * pictures even when a project has both. Stored as a data URL like the icon,
 * which keeps it working for projects on machines the renderer cannot read
 * files from.
 */
export type RepoBanner = {
  src: string
  /** The file it came from, for the settings row to name what is set. */
  label?: string
}

/** The same ceiling the icon uses; the picker enforces it on the way in too. */
export const MAX_REPO_BANNER_DATA_URL_LENGTH = MAX_REPO_ICON_DATA_URL_LENGTH

const MAX_BANNER_LABEL_LENGTH = 200

/**
 * Returns the banner only if its image is one Orca is willing to render.
 * Anything else — a remote URL, an SVG, an oversized blob — becomes null
 * rather than being passed along for a renderer to deal with.
 */
export function sanitizeRepoBanner(value: unknown): RepoBanner | null {
  if (!value || typeof value !== 'object') {
    return null
  }
  const banner = value as { src?: unknown; label?: unknown }
  if (typeof banner.src !== 'string' || banner.src.length > MAX_REPO_BANNER_DATA_URL_LENGTH) {
    return null
  }
  // Why: a RASTER data URL, and nothing else. validateRasterImageDataUri
  // passes anything it does not recognise as raster straight through — right
  // for an icon, where a remote favicon is legitimate, and wrong twice over
  // here: a board of banners must fetch nothing, and `image/svg+xml` is not
  // raster, so it would sail through carrying whatever script it likes.
  const mimeType = /^data:([^;,]+)/i.exec(banner.src)?.[1]
  if (!isKnownRasterImageMimeType(mimeType) || validateRasterImageDataUri(banner.src) === null) {
    return null
  }
  const label =
    typeof banner.label === 'string' && banner.label.trim()
      ? banner.label.trim().slice(0, MAX_BANNER_LABEL_LENGTH)
      : undefined
  return { src: banner.src, ...(label ? { label } : {}) }
}
