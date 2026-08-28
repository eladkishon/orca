// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fitImageToBanner } from './fit-image-to-banner'

/**
 * happy-dom has no canvas encoder, so the drawing surface is stubbed and the
 * assertions are about the DECISIONS: the shape it crops to, that it keeps
 * lowering quality until the bytes fit, and that it gives up rather than
 * storing something too large.
 */

const drawImage = vi.fn()
let encodedLengthByQuality: Record<string, number> = {}

beforeEach(() => {
  vi.clearAllMocks()
  encodedLengthByQuality = {}
  Object.defineProperty(HTMLImageElement.prototype, 'decode', {
    configurable: true,
    value: vi.fn(async function decode(this: HTMLImageElement) {
      Object.defineProperty(this, 'naturalWidth', { configurable: true, value: 4000 })
      Object.defineProperty(this, 'naturalHeight', { configurable: true, value: 3000 })
    })
  })
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: () => ({ drawImage })
  })
  Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
    configurable: true,
    value: (_type: string, quality: number) =>
      `data:image/jpeg;base64,${'a'.repeat(encodedLengthByQuality[String(quality)] ?? 10)}`
  })
})

describe('fitImageToBanner', () => {
  it('crops to the banner strip rather than squashing the picture into it', async () => {
    await fitImageToBanner('data:image/png;base64,zz')

    const [, dx, dy, dw, dh] = drawImage.mock.calls[0]
    // Cover: fill the strip, let the long edge overflow, centre what is left.
    expect(dw).toBeGreaterThanOrEqual(768)
    expect(dh).toBeGreaterThanOrEqual(192)
    expect(dw / dh).toBeCloseTo(4000 / 3000)
    expect(dx).toBeLessThanOrEqual(0)
    expect(dy).toBeLessThanOrEqual(0)
  })

  it('lowers quality until the bytes fit', async () => {
    encodedLengthByQuality = { '0.82': 400_000, '0.7': 250_000, '0.58': 10 }

    const fitted = await fitImageToBanner('data:image/png;base64,zz')

    expect(fitted).toContain('data:image/jpeg;base64,')
    expect(fitted?.length).toBeLessThan(180_000)
  })

  it('gives up rather than storing something too large', async () => {
    // Better to say no than to put a megabyte on a snapshot republished
    // several times a second.
    encodedLengthByQuality = { '0.82': 900_000, '0.7': 900_000, '0.58': 900_000, '0.45': 900_000 }

    expect(await fitImageToBanner('data:image/png;base64,zz')).toBeNull()
  })

  it('returns nothing for something it cannot decode', async () => {
    Object.defineProperty(HTMLImageElement.prototype, 'decode', {
      configurable: true,
      value: vi.fn(async () => {
        throw new Error('not an image')
      })
    })

    expect(await fitImageToBanner('data:text/plain;base64,zz')).toBeNull()
  })
})
