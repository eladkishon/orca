import { describe, expect, it } from 'vitest'
import {
  bannerMimeType,
  isPlausibleBannerSize,
  MAX_REPO_BANNER_SOURCE_BYTES,
  MIN_REPO_BANNER_SOURCE_BYTES,
  REPO_BANNER_FILE_CANDIDATES
} from './repo-banner-candidates'

describe('repo banner candidates', () => {
  it('looks where projects actually keep their pictures', () => {
    for (const path of [
      'banner.png',
      '.github/social-preview.png',
      'docs/hero.jpg',
      'public/og-image.png',
      'assets/screenshot.webp'
    ]) {
      expect([path, REPO_BANNER_FILE_CANDIDATES.includes(path)]).toEqual([path, true])
    }
  })

  it('offers raster types only, matching what a banner may be', () => {
    // An SVG would be refused later anyway, so offering one is a broken promise.
    expect(REPO_BANNER_FILE_CANDIDATES.some((path) => path.endsWith('.svg'))).toBe(false)
  })

  it('names the type of each candidate it offers', () => {
    expect(bannerMimeType('banner.PNG')).toBe('image/png')
    expect(bannerMimeType('docs/hero.jpeg')).toBe('image/jpeg')
    expect(bannerMimeType('notes.txt')).toBeUndefined()
  })

  it('rejects files too small or too large to be a banner', () => {
    // A 200-byte PNG is a spacer; a 40MB one is somebody's raw export.
    expect(isPlausibleBannerSize(200)).toBe(false)
    expect(isPlausibleBannerSize(MIN_REPO_BANNER_SOURCE_BYTES)).toBe(true)
    expect(isPlausibleBannerSize(MAX_REPO_BANNER_SOURCE_BYTES)).toBe(true)
    expect(isPlausibleBannerSize(MAX_REPO_BANNER_SOURCE_BYTES + 1)).toBe(false)
  })

  it('stays a fixed list rather than a directory walk', () => {
    // A repository can hold hundreds of thousands of files; a banner picker is
    // not worth a recursive scan of any of them.
    expect(REPO_BANNER_FILE_CANDIDATES.length).toBeLessThan(200)
  })
})
