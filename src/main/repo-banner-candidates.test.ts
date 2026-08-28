import { describe, expect, it } from 'vitest'
import {
  bannerMimeType,
  isBannerImageName,
  isPlausibleBannerSize,
  MAX_REPO_BANNER_SOURCE_BYTES,
  MIN_REPO_BANNER_SOURCE_BYTES,
  rankBannerCandidates,
  type RepoBannerFile
} from './repo-banner-candidates'

function file(relativePath: string, bytes = 100_000): RepoBannerFile {
  return { relativePath, bytes, depth: relativePath.split('/').length - 1 }
}

describe('banner image files', () => {
  it('accepts the raster types a banner may be', () => {
    expect(isBannerImageName('hero-premium-full.PNG')).toBe(true)
    expect(isBannerImageName('Nomadiq_White 2.jpg')).toBe(true)
    expect(isBannerImageName('shot.webp')).toBe(true)
  })

  it('refuses what a banner may not be', () => {
    // An SVG would be refused later anyway, so offering one is a broken promise.
    expect(isBannerImageName('logo.svg')).toBe(false)
    expect(isBannerImageName('notes.md')).toBe(false)
    expect(bannerMimeType('notes.md')).toBeUndefined()
  })

  it('rejects files too small or too large to be a banner', () => {
    expect(isPlausibleBannerSize(200)).toBe(false)
    expect(isPlausibleBannerSize(MIN_REPO_BANNER_SOURCE_BYTES)).toBe(true)
    expect(isPlausibleBannerSize(MAX_REPO_BANNER_SOURCE_BYTES + 1)).toBe(false)
  })
})

describe('rankBannerCandidates', () => {
  it('puts an image whose name says what it is for first', () => {
    // Someone called it "hero" on purpose.
    const ranked = rankBannerCandidates([
      file('docs/design-review/status-dark.png'),
      file('hero-premium-full.png')
    ])

    expect(ranked[0].relativePath).toBe('hero-premium-full.png')
  })

  it('prefers a picture kept somewhere deliberate over one buried', () => {
    const ranked = rankBannerCandidates([
      file('docs/design-review/notes/shot.png'),
      file('assets/shot.png')
    ])

    expect(ranked[0].relativePath).toBe('assets/shot.png')
  })

  it('prefers the larger image at equal standing', () => {
    // A banner is a big picture; what is left small is sprites and badges.
    const ranked = rankBannerCandidates([file('a/one.png', 20_000), file('a/two.png', 900_000)])

    expect(ranked[0].relativePath).toBe('a/two.png')
  })

  it('leaves the input alone', () => {
    const input = [file('b.png'), file('banner.png')]
    rankBannerCandidates(input)

    expect(input[0].relativePath).toBe('b.png')
  })
})
