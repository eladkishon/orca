import { describe, expect, it } from 'vitest'
import {
  defaultRepoBannerVariant,
  MAX_REPO_BANNER_DATA_URL_LENGTH,
  REPO_BANNER_VARIANTS,
  sanitizeRepoBanner
} from './repo-banner'

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

describe('sanitizeRepoBanner', () => {
  it('keeps a generated banner, which is a name rather than pixels', () => {
    expect(sanitizeRepoBanner({ kind: 'generated', variant: 'aurora' })).toEqual({
      kind: 'generated',
      variant: 'aurora'
    })
  })

  it('refuses a variant it does not know', () => {
    expect(sanitizeRepoBanner({ kind: 'generated', variant: 'hologram' })).toBeNull()
  })

  it('keeps a raster image and the file name it came from', () => {
    expect(sanitizeRepoBanner({ kind: 'image', src: PNG, label: '  hero.png  ' })).toEqual({
      kind: 'image',
      src: PNG,
      label: 'hero.png'
    })
  })

  it('refuses a remote URL, which would make the board fetch', () => {
    expect(sanitizeRepoBanner({ kind: 'image', src: 'https://example.test/a.png' })).toBeNull()
  })

  it('refuses an SVG data URL, which can carry script', () => {
    expect(
      sanitizeRepoBanner({ kind: 'image', src: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=' })
    ).toBeNull()
  })

  it('refuses anything past the size ceiling', () => {
    expect(
      sanitizeRepoBanner({
        kind: 'image',
        src: `data:image/png;base64,${'a'.repeat(MAX_REPO_BANNER_DATA_URL_LENGTH)}`
      })
    ).toBeNull()
  })

  it('refuses a shape that is not a banner at all', () => {
    expect(sanitizeRepoBanner(null)).toBeNull()
    expect(sanitizeRepoBanner({})).toBeNull()
    expect(sanitizeRepoBanner({ kind: 'image', src: 42 })).toBeNull()
  })
})

describe('defaultRepoBannerVariant', () => {
  it('gives a project the same banner every time', () => {
    expect(defaultRepoBannerVariant('repo-1')).toBe(defaultRepoBannerVariant('repo-1'))
  })

  it('always names a variant that exists', () => {
    for (const id of ['', 'a', 'repo-1', 'x'.repeat(200)]) {
      expect(REPO_BANNER_VARIANTS).toContain(defaultRepoBannerVariant(id))
    }
  })

  it('spreads neighbouring projects across the variants', () => {
    const drawn = new Set(['repo-1', 'repo-2', 'repo-3', 'repo-4'].map(defaultRepoBannerVariant))

    expect(drawn.size).toBeGreaterThan(1)
  })
})
