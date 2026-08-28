import { ipcMain } from 'electron'
import { readFile, stat } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import {
  bannerMimeType,
  isPlausibleBannerSize,
  MAX_REPO_BANNER_CANDIDATES,
  REPO_BANNER_FILE_CANDIDATES,
  type RepoBannerCandidate
} from '../repo-banner-candidates'

/**
 * Reads the pictures a repository already contains that could serve as a board
 * banner. Its own module because it reads files on the user's behalf, and that
 * deserves to be read in one piece rather than found inside a general shell
 * handler.
 */
export function registerRepoBannerCandidateIpc(): void {
  // Why no removeHandler: the shell handlers around this one register once at
  // startup and never re-register, and adding a teardown call here made this
  // module demand more of the electron surface than its neighbours do.
  ipcMain.handle(
    'shell:findRepoBannerCandidates',
    async (_event, args: { repoPath?: unknown }): Promise<RepoBannerCandidate[]> => {
      const repoPath = args?.repoPath
      if (typeof repoPath !== 'string' || !repoPath) {
        return []
      }
      const root = resolve(repoPath)
      const candidates: RepoBannerCandidate[] = []
      for (const relativePath of REPO_BANNER_FILE_CANDIDATES) {
        if (candidates.length >= MAX_REPO_BANNER_CANDIDATES) {
          break
        }
        const mimeType = bannerMimeType(relativePath)
        if (!mimeType) {
          continue
        }
        // Why resolve and re-check: every candidate is a fixed literal, but
        // joining one to a caller-supplied root is still where traversal would
        // enter, and this reads files on the user's behalf.
        const filePath = resolve(root, relativePath)
        if (!filePath.startsWith(root + sep)) {
          continue
        }
        try {
          const stats = await stat(filePath)
          if (!stats.isFile() || !isPlausibleBannerSize(stats.size)) {
            continue
          }
          const buffer = await readFile(filePath)
          candidates.push({
            relativePath,
            dataUrl: `data:${mimeType};base64,${buffer.toString('base64')}`
          })
        } catch {
          // A missing candidate is the normal case, not a failure.
        }
      }
      return candidates
    }
  )
}
