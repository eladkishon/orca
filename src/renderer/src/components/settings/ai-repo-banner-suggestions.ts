import { useState } from 'react'
import {
  buildRepoBannerPrompt,
  truncateReadmeExcerpt,
  type RepoBannerReferenceImage
} from '../../../../shared/repo-banner-ai-prompt'
import type { RepoBannerCandidate } from './find-repo-banner-candidates'

/** How many of the repo's own images to hand to Gemini as visual reference. */
const MAX_REFERENCE_IMAGES = 2

const README_NAME_PATTERN = /^readme\.md$/i

/** Finds and reads the repo's own README, if any, for prompt context. */
async function readRepoReadme(repoPath: string): Promise<string | undefined> {
  const fs = window.api?.fs
  if (!fs?.listFiles || !fs.readFile) {
    return undefined
  }
  const paths = await fs.listFiles({ rootPath: repoPath })
  const readmePath = paths.find((path) => README_NAME_PATTERN.test(path))
  if (!readmePath) {
    return undefined
  }
  try {
    const read = await fs.readFile({ filePath: `${repoPath}/${readmePath}` })
    return read.isBinary ? undefined : read.content
  } catch {
    return undefined
  }
}

function toReferenceImage(candidate: RepoBannerCandidate): RepoBannerReferenceImage | null {
  const match = /^data:([^;,]+);base64,(.+)$/.exec(candidate.dataUrl)
  return match ? { mimeType: match[1], base64Data: match[2] } : null
}

export function useAiRepoBannerSuggestions(): {
  suggestions: { dataUrl: string }[]
  loading: boolean
  /** Rejects if generation fails, so the caller can show its own error toast. */
  generate: (
    repo: { path: string; displayName: string },
    candidates: RepoBannerCandidate[]
  ) => Promise<void>
} {
  const [suggestions, setSuggestions] = useState<{ dataUrl: string }[]>([])
  const [loading, setLoading] = useState(false)

  const generate = async (
    repo: { path: string; displayName: string },
    candidates: RepoBannerCandidate[]
  ): Promise<void> => {
    setLoading(true)
    setSuggestions([])
    try {
      const readme = await readRepoReadme(repo.path)
      const referenceImages = candidates
        .slice(0, MAX_REFERENCE_IMAGES)
        .map(toReferenceImage)
        .filter((image): image is RepoBannerReferenceImage => image !== null)
      const prompt = buildRepoBannerPrompt({
        repoName: repo.displayName,
        readmeExcerpt: readme ? truncateReadmeExcerpt(readme) : undefined,
        hasReferenceImages: referenceImages.length > 0
      })
      const results = await window.api.aiImages.generateRepoBanners({ prompt, referenceImages })
      setSuggestions(results)
    } finally {
      setLoading(false)
    }
  }

  return { suggestions, loading, generate }
}
