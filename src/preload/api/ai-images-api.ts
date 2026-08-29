import type { RepoBannerReferenceImage } from '../../shared/repo-banner-ai-prompt'

export type AiImagesApi = {
  /** Generates a small batch of AI-suggested board banner images via Gemini. */
  generateRepoBanners: (args: {
    prompt: string
    referenceImages: RepoBannerReferenceImage[]
  }) => Promise<{ dataUrl: string }[]>
}
