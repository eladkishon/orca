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
 * The renderer reloads, so a feature built on `fs.listFiles` / `fs.readFile`
 * works the moment it is written. Those two already do the hard parts: the
 * listing is the quick-open index, so it respects .gitignore and skips
 * node_modules for free, and reading an image already comes back base64 with
 * its mime type.
 *
 * Sizes cost a round trip each, so only the best-named handful is measured.
 */
export async function findRepoBannerCandidates(
  repoPath: string,
  signal?: { cancelled: boolean }
): Promise<RepoBannerCandidate[]> {
  const fs = window.api?.fs
  if (!fs?.listFiles || !fs.stat || !fs.readFile) {
    return []
  }
  const paths = await fs.listFiles({ rootPath: repoPath })
  const images = paths.filter((path) => isBannerImageName(path))
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
