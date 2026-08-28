/**
 * Picks the pictures already in a repo that would make a decent board banner.
 *
 * People have screenshots and logos in a project long before they think of
 * setting a banner, so offering those beats an empty file dialog: "what image
 * represents this project" is a question the repository has usually answered.
 *
 * Two earlier versions got the *finding* wrong. The first probed a fixed list
 * of likely paths and found nothing in any real repository, because projects
 * name their images after what they show. The second walked the tree from the
 * main process — correct, but main-process code only loads on an app restart,
 * so the feature did not exist until one happened. Neither is this file's
 * problem any more: the repo's own file listing does the finding, and what is
 * left here is choosing, which is pure and belongs to nobody's process.
 */

/** Raster only, matching what a banner is allowed to be. */
const BANNER_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp'])

/** Enough to offer a choice; more is a gallery nobody asked for. */
export const MAX_REPO_BANNER_CANDIDATES = 8
/** Below this a "picture" is an icon or a spacer, not a banner. */
export const MIN_REPO_BANNER_SOURCE_BYTES = 8 * 1024
/** Above this, reading it costs more than the picker is worth. */
export const MAX_REPO_BANNER_SOURCE_BYTES = 6 * 1024 * 1024
/** Total bytes returned, so eight large screenshots cannot flood the bridge. */
export const MAX_REPO_BANNER_TOTAL_BYTES = 12 * 1024 * 1024

/** Names that say "this image is meant to show the project".
 *
 *  Deliberately no `icon` or `logo`: an icon is a small square glyph, which is
 *  the one shape a 4:1 banner cannot use, and treating those words as a hint
 *  put app icons above the actual hero image in every repo tried. They can
 *  still be offered — they just have to earn it on size like anything else. */
const PROMISING_NAME = /banner|hero|cover|og[-_]?image|social|screenshot|preview|demo/i

export type RepoBannerFile = {
  /** Repo-relative, so the picker can say where each one came from. */
  relativePath: string
  bytes: number
  /** Directory depth, used to prefer pictures kept somewhere deliberate. */
  depth: number
}

/** How many files to measure before choosing: sizes cost a round trip each, and
 *  the name and location already put the plausible ones near the top. */
export const MAX_REPO_BANNER_MEASURED = 24

export function repoBannerFileDepth(relativePath: string): number {
  let depth = 0
  for (const character of relativePath) {
    if (character === '/' || character === '\\') {
      depth += 1
    }
  }
  return depth
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
