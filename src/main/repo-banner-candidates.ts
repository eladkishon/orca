/**
 * Finds pictures already in a repo that would make a decent board banner.
 *
 * People have screenshots and logos in a project long before they think of
 * setting a banner, so offering those beats an empty file dialog: "what image
 * represents this project" is a question the repository has usually answered.
 *
 * An earlier version probed a fixed list of likely paths — banner.png,
 * .github/social-preview.png and so on — and found nothing in any real
 * repository, because real projects name their images after what they show.
 * So this scans, but on a leash: a bounded breadth-first walk that refuses the
 * directories where images are never the point.
 */

/** Raster only, matching what a banner is allowed to be. */
const BANNER_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp'])

/** Directories whose images are build output, dependencies or caches. */
export const BANNER_SCAN_SKIPPED_DIRECTORIES = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'out',
  'target',
  'vendor',
  'coverage',
  '.next',
  '.nuxt',
  '.turbo',
  '.cache',
  '.venv',
  'venv',
  '__pycache__',
  'DerivedData',
  'Pods'
])

/** Deep enough for docs/design-review/x.png, shallow enough to stay quick. */
export const BANNER_SCAN_MAX_DEPTH = 3
/** A ceiling on the walk itself, so a monorepo cannot turn this into a crawl. */
export const BANNER_SCAN_MAX_ENTRIES = 4_000
/** Enough to offer a choice; more is a gallery nobody asked for. */
export const MAX_REPO_BANNER_CANDIDATES = 8
/** Below this a "picture" is an icon or a spacer, not a banner. */
export const MIN_REPO_BANNER_SOURCE_BYTES = 8 * 1024
/** Above this, reading it costs more than the picker is worth. */
export const MAX_REPO_BANNER_SOURCE_BYTES = 6 * 1024 * 1024
/** Total bytes returned, so eight large screenshots cannot flood the bridge. */
export const MAX_REPO_BANNER_TOTAL_BYTES = 12 * 1024 * 1024

/** Names that say "this image is meant to represent the project". */
const PROMISING_NAME = /banner|hero|cover|og[-_]?image|social|preview|screenshot|logo|icon|brand/i

export type RepoBannerFile = {
  /** Repo-relative, so the picker can say where each one came from. */
  relativePath: string
  bytes: number
  /** Directory depth, used to prefer pictures kept somewhere deliberate. */
  depth: number
}

export type RepoBannerCandidate = {
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

export function isBannerImageName(fileName: string): boolean {
  return BANNER_EXTENSIONS.has(fileName.slice(fileName.lastIndexOf('.')).toLowerCase())
}

/**
 * Whether a file's size makes it a plausible banner. Both ends matter: a small
 * PNG is a spacer or a sprite, and a very large one costs more to carry than
 * the picker is worth.
 */
export function isPlausibleBannerSize(bytes: number): boolean {
  return bytes >= MIN_REPO_BANNER_SOURCE_BYTES && bytes <= MAX_REPO_BANNER_SOURCE_BYTES
}

/**
 * Orders what the walk found, best first.
 *
 * A name that says what the image is for wins outright — someone called it
 * `hero` on purpose. After that, shallower beats deeper (a picture at the root
 * or in assets/ was put there deliberately, one four levels down is usually
 * incidental), and larger beats smaller, because a banner is a big picture and
 * the small ones left are sprites and badges.
 */
export function rankBannerCandidates(files: readonly RepoBannerFile[]): RepoBannerFile[] {
  return [...files].sort((first, second) => {
    const firstPromising = PROMISING_NAME.test(first.relativePath) ? 0 : 1
    const secondPromising = PROMISING_NAME.test(second.relativePath) ? 0 : 1
    if (firstPromising !== secondPromising) {
      return firstPromising - secondPromising
    }
    if (first.depth !== second.depth) {
      return first.depth - second.depth
    }
    return second.bytes - first.bytes
  })
}
