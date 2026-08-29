import { net } from 'electron'
import type { RepoBannerReferenceImage } from '../../shared/repo-banner-ai-prompt'

/** gemini-2.5-flash-image ("nano banana") is Google's current image-gen model
 *  reachable via the public Generative Language API with a plain API key. */
const IMAGE_MODEL = 'gemini-2.5-flash-image'
const GENERATE_URL = `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent`
const API_TIMEOUT_MS = 30_000

type InlineDataPart = { inlineData: { mimeType: string; data: string } }
type TextPart = { text: string }
type GeminiPart = InlineDataPart | TextPart

function isInlineDataPart(part: GeminiPart): part is InlineDataPart {
  return 'inlineData' in part
}

export async function generateRepoBanners({
  apiKey,
  prompt,
  referenceImages,
  count
}: {
  apiKey: string
  prompt: string
  referenceImages: readonly RepoBannerReferenceImage[]
  count: number
}): Promise<{ dataUrl: string }[]> {
  if (!apiKey.trim()) {
    throw new Error('No Gemini API key is configured.')
  }

  const parts: GeminiPart[] = [
    { text: prompt },
    ...referenceImages.map(
      (image): InlineDataPart => ({
        inlineData: { mimeType: image.mimeType, data: image.base64Data }
      })
    )
  ]

  const requests = Array.from({ length: count }, () =>
    generateOne({ apiKey, parts }).catch((error) => {
      console.warn('[gemini] Banner generation attempt failed:', error)
      return null
    })
  )
  const results = (await Promise.all(requests)).filter(
    (result): result is { dataUrl: string } => result !== null
  )
  if (results.length === 0) {
    throw new Error('Gemini did not return any banner images.')
  }
  return results
}

async function generateOne({
  apiKey,
  parts
}: {
  apiKey: string
  parts: GeminiPart[]
}): Promise<{ dataUrl: string }> {
  const res = await net.fetch(`${GENERATE_URL}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts }] }),
    signal: AbortSignal.timeout(API_TIMEOUT_MS)
  })
  if (!res.ok) {
    throw new Error(`Gemini image generation failed (HTTP ${res.status})`)
  }
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: GeminiPart[] } }[]
  }
  const responseParts = data.candidates?.[0]?.content?.parts ?? []
  const imagePart = responseParts.find(isInlineDataPart)
  if (!imagePart) {
    throw new Error('Gemini response contained no image.')
  }
  return { dataUrl: `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}` }
}
