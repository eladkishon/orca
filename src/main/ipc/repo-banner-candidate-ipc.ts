import { ipcMain } from 'electron'
import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative, resolve, sep } from 'node:path'
import {
  bannerMimeType,
  BANNER_SCAN_MAX_DEPTH,
  BANNER_SCAN_MAX_ENTRIES,
  BANNER_SCAN_SKIPPED_DIRECTORIES,
  isBannerImageName,
  isPlausibleBannerSize,
  MAX_REPO_BANNER_CANDIDATES,
  MAX_REPO_BANNER_TOTAL_BYTES,
  rankBannerCandidates,
  type RepoBannerCandidate,
  type RepoBannerFile
} from '../repo-banner-candidates'

/**
 * Reads the pictures a repository already contains that could serve as a board
 * banner. Its own module because it reads files on the user's behalf, and that
 * deserves to be read in one piece rather than found inside a general shell
 * handler.
 *
 * The walk is breadth-first and bounded twice over — by depth and by how many
 * directory entries it will look at — so the cost is the same on a small
 * project and on a monorepo. It stops looking rather than looking harder.
 */
async function findBannerFiles(root: string): Promise<RepoBannerFile[]> {
  const found: RepoBannerFile[] = []
  let examined = 0
  let queue: { path: string; depth: number }[] = [{ path: root, depth: 0 }]

  while (queue.length > 0 && examined < BANNER_SCAN_MAX_ENTRIES) {
    const next: typeof queue = []
    for (const directory of queue) {
      if (examined >= BANNER_SCAN_MAX_ENTRIES) {
        break
      }
      let entries
      try {
        entries = await readdir(directory.path, { withFileTypes: true })
      } catch {
        continue
      }
      for (const entry of entries) {
        examined += 1
        if (examined >= BANNER_SCAN_MAX_ENTRIES) {
          break
        }
        const entryPath = join(directory.path, entry.name)
        if (entry.isDirectory()) {
          if (
            directory.depth + 1 <= BANNER_SCAN_MAX_DEPTH &&
            !BANNER_SCAN_SKIPPED_DIRECTORIES.has(entry.name)
          ) {
            next.push({ path: entryPath, depth: directory.depth + 1 })
          }
          continue
        }
        if (!entry.isFile() || !isBannerImageName(entry.name)) {
          continue
        }
        try {
          const stats = await stat(entryPath)
          if (isPlausibleBannerSize(stats.size)) {
            found.push({
              relativePath: relative(root, entryPath),
              bytes: stats.size,
              depth: directory.depth
            })
          }
        } catch {
          // A file that vanished between listing and stat is not a failure.
        }
      }
    }
    queue = next
  }
  return found
}

export function registerRepoBannerCandidateIpc(): void {
  // Why no removeHandler: the shell handlers around this one register once at
  // startup and never re-register.
  ipcMain.handle(
    'shell:findRepoBannerCandidates',
    async (_event, args: { repoPath?: unknown }): Promise<RepoBannerCandidate[]> => {
      const repoPath = args?.repoPath
      if (typeof repoPath !== 'string' || !repoPath) {
        return []
      }
      const root = resolve(repoPath)
      const ranked = rankBannerCandidates(await findBannerFiles(root))
      const candidates: RepoBannerCandidate[] = []
      let totalBytes = 0
      for (const candidate of ranked) {
        if (candidates.length >= MAX_REPO_BANNER_CANDIDATES) {
          break
        }
        const mimeType = bannerMimeType(candidate.relativePath)
        if (!mimeType || totalBytes + candidate.bytes > MAX_REPO_BANNER_TOTAL_BYTES) {
          continue
        }
        // Why re-resolve and re-check: the walk stays inside the root, but a
        // symlink can leave it, and this reads files on the user's behalf.
        const filePath = resolve(root, candidate.relativePath)
        if (!filePath.startsWith(root + sep)) {
          continue
        }
        try {
          const buffer = await readFile(filePath)
          candidates.push({
            relativePath: candidate.relativePath,
            dataUrl: `data:${mimeType};base64,${buffer.toString('base64')}`
          })
          totalBytes += candidate.bytes
        } catch {
          // Unreadable is the same as absent for a picker.
        }
      }
      return candidates
    }
  )
}
