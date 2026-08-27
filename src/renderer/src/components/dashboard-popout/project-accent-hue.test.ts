import { describe, expect, it } from 'vitest'
import { projectAccentHue } from './project-accent-hue'

describe('projectAccentHue', () => {
  it('gives the same project the same hue every time', () => {
    expect(projectAccentHue('repo-1')).toBe(projectAccentHue('repo-1'))
  })

  it('gives different projects different hues', () => {
    const hues = ['repo-1', 'repo-2', 'repo-3', 'ams', 'brain', 'orca'].map(projectAccentHue)

    expect(new Set(hues).size).toBe(hues.length)
  })

  it('stays on the colour wheel', () => {
    for (const id of ['', 'a', 'repo-1', 'folder-workspace:group-9', 'x'.repeat(300)]) {
      const hue = projectAccentHue(id)
      expect(hue).toBeGreaterThanOrEqual(0)
      expect(hue).toBeLessThan(360)
    }
  })

  it('spreads a run of sibling ids around the wheel', () => {
    // Sequential ids are the common case; landing them next to each other would
    // make exactly the projects most likely to be adjacent hardest to tell apart.
    const hues = ['repo-1', 'repo-2', 'repo-3', 'repo-4'].map(projectAccentHue)
    const closest = Math.min(
      ...hues.flatMap((hue, index) =>
        hues.slice(index + 1).map((other) => {
          const gap = Math.abs(hue - other)
          return Math.min(gap, 360 - gap)
        })
      )
    )

    expect(closest).toBeGreaterThan(20)
  })
})
