/**
 * Finds pictures already in a repo that would make a decent board banner.
 *
 * People have a logo or a screenshot in the project long before they think of
 * setting a banner. Offering those is a better answer than an empty file
 * picker, because "what image represents this project" is a question the
 * repository has usually already answered.
 *
 * Deliberately a fixed list of likely paths rather than a directory walk: a
 * repository can hold hundreds of thousands of files, and a banner picker is
 * not worth a recursive scan of any of them.
 */

const BANNER_STEMS = [
  'banner',
  'hero',
  'cover',
  'og-image',
  'social-preview',
  'screenshot',
  'preview',
  'logo',
  'docs/banner',
  'docs/hero',
  'docs/screenshot',
  'docs/images/banner',
  'docs/images/hero',
  'assets/banner',
  'assets/hero',
  'assets/cover',
  'assets/screenshot',
  'assets/logo',
  'public/banner',
  'public/hero',
  'public/og-image',
  'public/social-preview',
  'public/logo',
  'static/banner',
  'static/hero',
  'static/logo',
  '.github/banner',
  '.github/hero',
  '.github/social-preview',
  'media/banner',
  'media/hero',
  'images/banner',
  'images/hero'
] as const

/** Raster only, matching what a banner is allowed to be. */
const BANNER_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'] as const

export const REPO_BANNER_FILE_CANDIDATES = BANNER_STEMS.flatMap((stem) =>
  BANNER_EXTENSIONS.map((extension) => `${stem}${extension}`)
)

/** Enough to offer a choice; more is a gallery nobody asked for. */
export const MAX_REPO_BANNER_CANDIDATES = 8
/** A banner is re-encoded before it is stored, so a large original is fine —
 *  but not one that would cost more to read than the picker is worth. */
export const MAX_REPO_BANNER_SOURCE_BYTES = 8 * 1024 * 1024
/** Below this a "picture" is an icon or a spacer, not a banner. */
export const MIN_REPO_BANNER_SOURCE_BYTES = 4 * 1024

export type RepoBannerCandidate = {
  /** Repo-relative, so the picker can say where each one came from. */
  relativePath: string
  dataUrl: string
}

const MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp'
}

export function bannerMimeType(relativePath: string): string | undefined {
  const extension = relativePath.slice(relativePath.lastIndexOf('.')).toLowerCase()
  return MIME_BY_EXTENSION[extension]
}

/**
 * Whether a file's size makes it a plausible banner. Both ends matter: a 200
 * byte PNG is a spacer and a 40MB one is somebody's raw export.
 */
export function isPlausibleBannerSize(bytes: number): boolean {
  return bytes >= MIN_REPO_BANNER_SOURCE_BYTES && bytes <= MAX_REPO_BANNER_SOURCE_BYTES
}
