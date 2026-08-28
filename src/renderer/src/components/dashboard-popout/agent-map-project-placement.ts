import { layoutAgentMapWorktreeLineage } from './agent-map-worktree-lineage-layout'

const PROJECT_GAP = 32

type ProjectCircle = {
  id: string
  x: number
  y: number
  radius: number
  clusterParentId?: string
}

// Projects are placed left-to-right in stable id order. A project that already
// had a position keeps it (so unrelated projects never jump when some other
// project's own size changes); the cursor only pushes a project forward when
// its previous slot would now overlap the project placed just before it —
// i.e. when its own membership, or an earlier project's growth, genuinely
// requires it to move.
function placeUnlinkedProjects<T extends ProjectCircle>(
  projects: T[],
  previousPositions?: ReadonlyMap<string, { x: number; y: number }>
): T[] {
  // Every project sits on the same row (y is otherwise always 0), so any
  // previously-anchored project's y already carries the frame's vertical
  // centering — reuse it for brand-new projects too instead of 0, or the
  // whole row would jump back to an unoffset y once anchoring skips re-centering below.
  const rowY = previousPositions?.values().next().value?.y ?? 0
  let cursorX = 0
  return projects.map((project) => {
    const previous = previousPositions?.get(project.id)
    const x =
      previous && previous.x - project.radius >= cursorX ? previous.x : cursorX + project.radius
    cursorX = x + project.radius + PROJECT_GAP
    return { ...project, x, y: previousPositions ? rowY : 0 }
  })
}

export function placeAgentMapProjects<T extends ProjectCircle>(
  projects: T[],
  minimumWidth: number,
  minimumHeight: number,
  worldMargin: number,
  previousPositions?: ReadonlyMap<string, { x: number; y: number }>
): { projects: T[]; width: number; height: number } {
  // ponytail: cross-project spawn clusters (clusterParentId) still fully
  // repack via layoutAgentMapWorktreeLineage on every change — rare path
  // (an agent in one repo spawning a worktree in another repo); upgrade to
  // anchored placement here too if that turns out to churn in practice.
  const positioned = projects.some((project) => project.clusterParentId)
    ? layoutAgentMapWorktreeLineage(projects)
    : placeUnlinkedProjects(projects, previousPositions)
  const left = Math.min(...positioned.map((project) => project.x - project.radius))
  const right = Math.max(...positioned.map((project) => project.x + project.radius))
  const top = Math.min(...positioned.map((project) => project.y - project.radius))
  const bottom = Math.max(...positioned.map((project) => project.y + project.radius))
  const naturalWidth = right - left + worldMargin * 2
  const naturalHeight = bottom - top + worldMargin * 2
  const width = Math.max(minimumWidth, naturalWidth)
  const height = Math.max(minimumHeight, naturalHeight)
  // Anchored projects already carry absolute coordinates from the previous
  // frame — re-centering the whole frame here (e.g. because the total content
  // width crossed the minimum-width padding threshold) would drag every
  // ring sideways even though nothing about it changed. Only the very first
  // layout (no previous positions to anchor to) gets centered within the
  // minimum canvas size.
  const offsetX = previousPositions ? 0 : worldMargin - left + (width - naturalWidth) / 2
  const offsetY = previousPositions ? 0 : worldMargin - top + (height - naturalHeight) / 2
  return {
    projects: positioned.map((project) => ({
      ...project,
      x: project.x + offsetX,
      y: project.y + offsetY
    })),
    width,
    height
  }
}
