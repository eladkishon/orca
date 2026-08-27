/**
 * A stable, distinct accent hue for every project.
 *
 * Projects need to be told apart at a glance on a board that groups by them,
 * and a badge colour someone may never have set — or may have set the same as
 * another project's — cannot promise that. This derives one from the project's
 * id instead: same project, same colour, every session and every window, with
 * no state to store and nothing to plumb across the snapshot.
 *
 * Only the hue is derived. Lightness and chroma are fixed by the stylesheet
 * per theme, so no project ends up dimmer or louder than its neighbours —
 * picking whole colours by hash is what makes generated palettes look random.
 */

/** Successive ids land far apart on the wheel rather than in a run. */
const GOLDEN_ANGLE_DEGREES = 137.508

function hashProjectId(projectId: string): number {
  // FNV-1a: short, well spread over the small ids we get, and stable across
  // platforms — unlike anything built on a JS engine's own hashing.
  let hash = 0x811c9dc5
  for (let index = 0; index < projectId.length; index += 1) {
    hash ^= projectId.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/** Degrees on the colour wheel, for `oklch(... var(--project-hue))`. */
export function projectAccentHue(projectId: string): number {
  return Math.round((hashProjectId(projectId) * GOLDEN_ANGLE_DEGREES) % 360)
}
