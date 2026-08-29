import {
  bannerMimeType,
  isBannerImageName,
  isPlausibleBannerSize,
  MAX_REPO_BANNER_CANDIDATES,
  MAX_REPO_BANNER_MEASURED,
  rankBannerCandidates,
  repoBannerFileDepth,
  type RepoBannerFile
} from '../../../../shared/repo-banner-candidates'

export type RepoBannerCandidate = { relativePath: string; dataUrl: string }

/**
 * Finds a repo's own pictures using the file APIs Orca already has.
 *
 * Why here rather than in the main process, where a directory walk would
 * normally belong: main-process code only loads when the app restarts, so a
 * banner scan living there did not exist for anyone who had not restarted —
 * the picker rendered, the swatches worked, and no image was ever offered.
 * The renderer reloads, so a feature built on `fs.readDir` / `fs.readFile`
 * works the moment it is written.
 *
 * Why a bounded walk rather than the quick-open listing it used to call: that
 * listing is unbounded and includes a gitignored pass, so on a repo with build
 * output and nested worktrees (millions of paths) it hit the 10s scan timeout
 * and the picker could only say it had failed. A banner lives near the top of
 * a repo or not at all, so look there and stop.
 *
 * Sizes cost a round trip each, so only the best-named handful is measured.
 */
export async function findRepoBannerCandidates(
  repoPath: string,
  signal?: { cancelled: boolean }
): Promise<RepoBannerCandidate[]> {
  const fs = window.api?.fs
  if (!fs?.readDir || !fs.stat || !fs.readFile) {
    return []
  }
  const images = await listNearbyImagePaths(fs, repoPath, signal)
  // Ranked once on name and location alone, to decide what is worth measuring.
  const shortlist = rankBannerCandidates(
    images.map((relativePath) => ({
      relativePath,
      bytes: 0,
      depth: repoBannerFileDepth(relativePath)
    }))
  ).slice(0, MAX_REPO_BANNER_MEASURED)

  const measured: RepoBannerFile[] = []
  await Promise.all(
    shortlist.map(async (file) => {
      try {
        const stats = await fs.stat({ filePath: `${repoPath}/${file.relativePath}` })
        if (!stats.isDirectory && isPlausibleBannerSize(stats.size)) {
          measured.push({ ...file, bytes: stats.size })
        }
      } catch {
        // A file that cannot be measured is one we cannot offer.
      }
    })
  )
  if (signal?.cancelled) {
    return []
  }

  const chosen = rankBannerCandidates(measured).slice(0, MAX_REPO_BANNER_CANDIDATES)
  const candidates = await Promise.all(
    chosen.map(async (file) => {
      const mimeType = bannerMimeType(file.relativePath)
      if (!mimeType) {
        return null
      }
      try {
        const read = await fs.readFile({ filePath: `${repoPath}/${file.relativePath}` })
        // Why isImage: the reader only base64s what it recognised as an image;
        // anything else comes back as text and would paint nothing.
        if (!read.isImage || !read.content) {
          return null
        }
        return {
          relativePath: file.relativePath,
          dataUrl: `data:${read.mimeType ?? mimeType};base64,${read.content}`
        }
      } catch {
        return null
      }
    })
  )
  return candidates.filter((candidate): candidate is RepoBannerCandidate => candidate !== null)
}

/** A banner kept on purpose sits at the root, in assets/, or in docs/images/. */
const MAX_SCAN_DEPTH = 3
/** Bounds the walk so a repo full of build output still answers instantly. */
const MAX_SCANNED_DIRS = 300
/** Generated trees that are not dot-directories, so the shared prune misses them. */
const SKIPPED_DIR_NAMES = new Set([
  'build',
  'coverage',
  'dist',
  'node_modules',
  'out',
  'Pods',
  'target',
  'vendor'
])

/** Breadth-first over the top of the repo, widest level first. Only the root's
 *  failure is reported — a directory that cannot be read deeper down is one we
 *  simply have no pictures from. */
async function listNearbyImagePaths(
  fs: NonNullable<typeof window.api>['fs'],
  repoPath: string,
  signal?: { cancelled: boolean }
): Promise<string[]> {
  const images: string[] = []
  let level = ['']
  let scanned = 0
  for (let depth = 0; depth <= MAX_SCAN_DEPTH && level.length > 0; depth += 1) {
    const next: string[] = []
    const entriesByDir = await Promise.all(
      level.map(async (relativeDir) => {
        if (scanned >= MAX_SCANNED_DIRS || signal?.cancelled) {
          return []
        }
        scanned += 1
        const dirPath = relativeDir ? `${repoPath}/${relativeDir}` : repoPath
        if (depth === 0) {
          return fs.readDir({ dirPath })
        }
        try {
          return await fs.readDir({ dirPath })
        } catch {
          return []
        }
      })
    )
    entriesByDir.forEach((entries, index) => {
      const prefix = level[index] ? `${level[index]}/` : ''
      for (const entry of entries) {
        if (entry.isSymlink) {
          continue
        }
        if (entry.isDirectory) {
          // .github earns an exception: it is where a repo keeps its social preview.
          const hidden = entry.name.startsWith('.') && entry.name !== '.github'
          if (!hidden && !SKIPPED_DIR_NAMES.has(entry.name)) {
            next.push(`${prefix}${entry.name}`)
          }
        } else if (isBannerImageName(entry.name)) {
          images.push(`${prefix}${entry.name}`)
        }
      }
    })
    level = next
  }
  return images
}
