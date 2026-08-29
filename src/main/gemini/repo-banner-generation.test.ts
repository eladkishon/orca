import { describe, expect, it, vi, beforeEach } from 'vitest'

const { netFetchMock } = vi.hoisted(() => ({ netFetchMock: vi.fn() }))
vi.mock('electron', () => ({ net: { fetch: netFetchMock } }))

import { generateRepoBanners } from './repo-banner-generation'

function jsonResponse(body: unknown, ok = true): Response {
  return { ok, status: ok ? 200 : 500, json: async () => body } as unknown as Response
}

describe('generateRepoBanners', () => {
  beforeEach(() => {
    netFetchMock.mockReset()
  })

  it('rejects when no API key is configured', async () => {
    await expect(
      generateRepoBanners({ apiKey: '', prompt: 'p', referenceImages: [], count: 1 })
    ).rejects.toThrow('No Gemini API key')
    expect(netFetchMock).not.toHaveBeenCalled()
  })

  it('returns a data URL per successful generation', async () => {
    netFetchMock.mockResolvedValue(
      jsonResponse({
        candidates: [
          { content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'AAA' } }] } }
        ]
      })
    )
    const results = await generateRepoBanners({
      apiKey: 'key',
      prompt: 'p',
      referenceImages: [],
      count: 2
    })
    expect(results).toEqual([
      { dataUrl: 'data:image/png;base64,AAA' },
      { dataUrl: 'data:image/png;base64,AAA' }
    ])
    expect(netFetchMock).toHaveBeenCalledTimes(2)
  })

  it('throws when every attempt fails', async () => {
    netFetchMock.mockResolvedValue(jsonResponse({}, false))
    await expect(
      generateRepoBanners({ apiKey: 'key', prompt: 'p', referenceImages: [], count: 1 })
    ).rejects.toThrow('did not return any banner images')
  })

  it('sends reference images as inline data parts', async () => {
    netFetchMock.mockResolvedValue(
      jsonResponse({
        candidates: [
          { content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'AAA' } }] } }
        ]
      })
    )
    await generateRepoBanners({
      apiKey: 'key',
      prompt: 'describe this',
      referenceImages: [{ mimeType: 'image/jpeg', base64Data: 'REF' }],
      count: 1
    })
    const body = JSON.parse(netFetchMock.mock.calls[0][1].body)
    expect(body.contents[0].parts).toEqual([
      { text: 'describe this' },
      { inlineData: { mimeType: 'image/jpeg', data: 'REF' } }
    ])
  })
})
