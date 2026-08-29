// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAiRepoBannerSuggestions } from './ai-repo-banner-suggestions'

describe('useAiRepoBannerSuggestions', () => {
  it('sends reference images decoded from repo candidate data URLs, and README text as the prompt basis', async () => {
    const generateRepoBanners = vi
      .fn()
      .mockResolvedValue([{ dataUrl: 'data:image/png;base64,OUT' }])
    const listFiles = vi.fn().mockResolvedValue(['README.md'])
    const readFile = vi
      .fn()
      .mockResolvedValue({ content: 'An agentic coding IDE.', isBinary: false })
    // @ts-expect-error partial window.api for this test
    window.api = { fs: { listFiles, readFile }, aiImages: { generateRepoBanners } }

    const { result } = renderHook(() => useAiRepoBannerSuggestions())
    await act(async () => {
      await result.current.generate({ path: '/repo', displayName: 'orca' }, [
        { relativePath: 'logo.png', dataUrl: 'data:image/png;base64,REF' }
      ])
    })

    expect(generateRepoBanners).toHaveBeenCalledWith({
      prompt: expect.stringContaining('An agentic coding IDE.'),
      referenceImages: [{ mimeType: 'image/png', base64Data: 'REF' }]
    })
    expect(result.current.suggestions).toEqual([{ dataUrl: 'data:image/png;base64,OUT' }])
    expect(result.current.loading).toBe(false)
  })
})
