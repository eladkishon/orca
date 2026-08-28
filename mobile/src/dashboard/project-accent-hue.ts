// Port of the desktop board's project hue (dashboard-popout/project-accent-hue.ts).
// Only the hue is derived; lightness and chroma are fixed here, as the desktop
// stylesheet fixes them per theme — picking whole colours by hash is what makes
// generated palettes look random. Mobile states them in HSL, the closest thing
// React Native has to the desktop's oklch.

/** Successive ids land far apart on the wheel rather than in a run. */
const GOLDEN_ANGLE_DEGREES = 137.508

function hashProjectId(projectId: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < projectId.length; index += 1) {
    hash ^= projectId.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/** Degrees on the colour wheel; same project, same colour, every session. */
export function projectAccentHue(projectId: string): number {
  return Math.round((hashProjectId(projectId) * GOLDEN_ANGLE_DEGREES) % 360)
}

/** The project title's colour — the dark-theme `.project-accent` tone. */
export function projectAccentColor(projectId: string): string {
  return `hsl(${projectAccentHue(projectId)}, 62%, 74%)`
}

/** The wash behind a project heading, fading to nothing (`.project-banner`). */
export function projectBannerColor(projectId: string, alpha = 0.14): string {
  return `hsla(${projectAccentHue(projectId)}, 60%, 66%, ${alpha})`
}
