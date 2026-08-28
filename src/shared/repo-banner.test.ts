import { describe, expect, it } from 'vitest'
import { MAX_REPO_BANNER_DATA_URL_LENGTH, sanitizeRepoBanner } from './repo-banner'

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

describe('sanitizeRepoBanner', () => {
  it('keeps a raster data URL', () => {
    expect(sanitizeRepoBanner({ src: PNG })).toEqual({ src: PNG })
  })

  it('keeps the file name it came from, trimmed', () => {
    expect(sanitizeRepoBanner({ src: PNG, label: '  hero.png  ' })).toEqual({
      src: PNG,
      label: 'hero.png'
    })
  })

  it('refuses a remote URL, which would make the board fetch', () => {
    // The icon validator passes non-raster URIs through — right for a favicon,
    // wrong for a banner rendered on every column of a live board.
    expect(sanitizeRepoBanner({ src: 'https://example.test/hero.png' })).toBeNull()
  })

  it('refuses an SVG data URL, which can carry script', () => {
    expect(sanitizeRepoBanner({ src: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=' })).toBeNull()
  })

  it('refuses anything past the size ceiling', () => {
    expect(
      sanitizeRepoBanner({
        src: `data:image/png;base64,${'a'.repeat(MAX_REPO_BANNER_DATA_URL_LENGTH)}`
      })
    ).toBeNull()
  })

  it('refuses a shape that is not a banner at all', () => {
    expect(sanitizeRepoBanner(null)).toBeNull()
    expect(sanitizeRepoBanner({})).toBeNull()
    expect(sanitizeRepoBanner({ src: 42 })).toBeNull()
  })
})
