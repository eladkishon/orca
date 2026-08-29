/**
 * Builds the text prompt sent to the image model for an AI-suggested board banner.
 *
 * Pure and side-effect free so it can be tested without touching the network or
 * the filesystem — the README excerpt and reference images are gathered by the
 * caller.
 */

export type RepoBannerReferenceImage = {
  mimeType: string
  base64Data: string
}

const MAX_README_EXCERPT_LENGTH = 500

export function truncateReadmeExcerpt(readme: string): string {
  const trimmed = readme.trim()
  return trimmed.length > MAX_README_EXCERPT_LENGTH
    ? `${trimmed.slice(0, MAX_README_EXCERPT_LENGTH)}…`
    : trimmed
}

export function buildRepoBannerPrompt({
  repoName,
  readmeExcerpt,
  hasReferenceImages
}: {
  repoName: string
  readmeExcerpt?: string
  hasReferenceImages: boolean
}): string {
  const lines = [
    `Create a wide banner image (4:1 aspect ratio) for a software project named "${repoName}".`,
    'The banner sits behind the project heading on a kanban-style board, so it should read well as a',
    'muted background: abstract, atmospheric, no text, no logos, no UI screenshots.'
  ]
  if (readmeExcerpt) {
    lines.push(`The project is described as: ${readmeExcerpt}`)
  }
  if (hasReferenceImages) {
    lines.push(
      'Reference images of the project are attached — draw inspiration from their subject matter,',
      'colors, or mood, without reproducing any text, logo, or screenshot content literally.'
    )
  }
  return lines.join(' ')
}
