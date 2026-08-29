import { ipcMain } from 'electron'
import { generateRepoBanners } from '../gemini/repo-banner-generation'
import type { RepoBannerReferenceImage } from '../../shared/repo-banner-ai-prompt'
import type { Store } from '../persistence'

const AI_BANNER_SUGGESTION_COUNT = 2

export function registerAiImageHandlers(store: Store): void {
  ipcMain.handle(
    'ai:generateRepoBanners',
    async (
      _event,
      { prompt, referenceImages }: { prompt: string; referenceImages: RepoBannerReferenceImage[] }
    ): Promise<{ dataUrl: string }[]> => {
      const apiKey = store.getSettings().geminiApiKey
      return generateRepoBanners({
        apiKey,
        prompt,
        referenceImages,
        count: AI_BANNER_SUGGESTION_COUNT
      })
    }
  )
}
