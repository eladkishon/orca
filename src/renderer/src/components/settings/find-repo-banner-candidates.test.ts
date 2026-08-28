import { afterEach, describe, expect, it, vi } from 'vitest'
import { findRepoBannerCandidates } from './find-repo-banner-candidates'

function installFs(files: Record<string, { size: number; isImage?: boolean }>): {
  stat: ReturnType<typeof vi.fn>
  readFile: ReturnType<typeof vi.fn>
} {
  const stat = vi.fn(async ({ filePath }: { filePath: string }) => {
    const name = filePath.replace(`/repo/`, '')
    return { size: files[name]?.size ?? 0, isDirectory: false, mtime: 0 }
  })
  const readFile = vi.fn(async ({ filePath }: { filePath: string }) => {
    const name = filePath.replace(`/repo/`, '')
    return {
      content: 'AAAA',
      isBinary: true,
      isImage: files[name]?.isImage !== false,
      mimeType: 'image/png'
    }
  })
  ;(globalThis as { window?: unknown }).window = {
    api: { fs: { listFiles: vi.fn(async () => Object.keys(files)), stat, readFile } }
  }
  return { stat, readFile }
}

afterEach(() => {
  ;(globalThis as { window?: unknown }).window = undefined
})

describe('findRepoBannerCandidates', () => {
  it('offers the repo’s own pictures, best-named first', async () => {
    installFs({
      'README.md': { size: 900 },
      'docs/assets/readme-hero.jpg': { size: 322_000 },
      'src/thing.ts': { size: 400 }
    })

    const found = await findRepoBannerCandidates('/repo')

    expect(found).toEqual([
      { relativePath: 'docs/assets/readme-hero.jpg', dataUrl: 'data:image/png;base64,AAAA' }
    ])
  })

  it('leaves out pictures too small to be a banner', async () => {
    // Sprites and badges are images, but they are not what a project looks like.
    installFs({ 'assets/spacer.png': { size: 300 } })

    expect(await findRepoBannerCandidates('/repo')).toEqual([])
  })

  it('measures only the shortlist, and reads only what it chose', async () => {
    // Both cost a round trip each, and this runs when a popover opens.
    const many = Object.fromEntries(
      Array.from({ length: 60 }, (_, index) => [`shot-${index}.png`, { size: 100_000 }])
    )
    const { stat, readFile } = installFs(many)

    const found = await findRepoBannerCandidates('/repo')

    expect(stat.mock.calls.length).toBe(24)
    expect(readFile.mock.calls.length).toBe(8)
    expect(found).toHaveLength(8)
  })

  it('drops a file the reader did not recognise as an image', async () => {
    // A non-image comes back as text, which would paint nothing at all.
    installFs({ 'assets/logo.png': { size: 100_000, isImage: false } })

    expect(await findRepoBannerCandidates('/repo')).toEqual([])
  })

  it('offers nothing rather than throwing where the file APIs are absent', async () => {
    ;(globalThis as { window?: unknown }).window = { api: {} }

    expect(await findRepoBannerCandidates('/repo')).toEqual([])
  })
})
