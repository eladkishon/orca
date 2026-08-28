/**
 * Fits a chosen picture to the banner it will become.
 *
 * People pick photographs, not banners: a 4000x3000 phone shot is both the
 * wrong shape for a strip behind a heading and far larger than a snapshot
 * republished several times a second should carry. Rather than rejecting it
 * with a size rule nobody can act on, this crops it to the banner's shape from
 * the centre and re-encodes it small enough to ship.
 *
 * Centre-crop rather than squash: a stretched image reads as a mistake, and the
 * middle of a picture is where its subject usually is.
 */

/** The strip a banner actually occupies, wide and short. */
const BANNER_ASPECT = 4
const BANNER_WIDTH = 768
const BANNER_HEIGHT = BANNER_WIDTH / BANNER_ASPECT
/** Comfortably under the data-URL ceiling, with room for base64's overhead. */
const TARGET_MAX_CHARS = 180_000
/** Tried in order until one fits; below the last, the picture is the problem. */
const QUALITY_LADDER = [0.82, 0.7, 0.58, 0.45] as const

async function loadImage(src: string): Promise<HTMLImageElement> {
  const image = new Image()
  image.decoding = 'async'
  image.src = src
  await image.decode()
  return image
}

/**
 * Returns a JPEG data URL cropped to the banner's shape, or null when the
 * picture cannot be decoded or refuses to compress far enough.
 */
export async function fitImageToBanner(src: string): Promise<string | null> {
  let image: HTMLImageElement
  try {
    image = await loadImage(src)
  } catch {
    return null
  }
  if (!image.naturalWidth || !image.naturalHeight) {
    return null
  }
  const canvas = document.createElement('canvas')
  canvas.width = BANNER_WIDTH
  canvas.height = BANNER_HEIGHT
  const context = canvas.getContext('2d')
  if (!context) {
    return null
  }
  // Cover: fill the strip entirely, letting the long edge overflow, then centre
  // what is left. This is what `object-fit: cover` does, done once at import so
  // the stored bytes are only the part that will ever be seen.
  const scale = Math.max(BANNER_WIDTH / image.naturalWidth, BANNER_HEIGHT / image.naturalHeight)
  const drawWidth = image.naturalWidth * scale
  const drawHeight = image.naturalHeight * scale
  context.drawImage(
    image,
    (BANNER_WIDTH - drawWidth) / 2,
    (BANNER_HEIGHT - drawHeight) / 2,
    drawWidth,
    drawHeight
  )
  for (const quality of QUALITY_LADDER) {
    // Why JPEG: a banner is a photograph behind text at low opacity, where
    // PNG's exactness buys nothing and costs several times the bytes.
    const encoded = canvas.toDataURL('image/jpeg', quality)
    if (encoded.length <= TARGET_MAX_CHARS) {
      return encoded
    }
  }
  return null
}
