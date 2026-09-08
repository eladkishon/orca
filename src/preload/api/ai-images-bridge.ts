import { ipcRenderer } from 'electron'
import type { RepoBannerReferenceImage } from '../../shared/repo-banner-ai-prompt'
import type { PreloadApi } from '../api-types'

export const aiImagesApi = {
  generateRepoBanners: (args: {
    prompt: string
    referenceImages: RepoBannerReferenceImage[]
  }): Promise<{ dataUrl: string }[]> => ipcRenderer.invoke('ai:generateRepoBanners', args)
} satisfies PreloadApi['aiImages']
