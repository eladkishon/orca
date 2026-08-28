import type { RepoIcon } from '../../../../shared/repo-icon'
import type { RepoBanner } from '../../../../shared/repo-banner'
import type { ActiveDashboardWorkspace } from './dashboard-snapshot-workspaces'

/**
 * The per-project visuals a board needs, collected as cards are built.
 *
 * Keyed by project rather than carried on every card: an image banner is a data
 * URL of up to 400KB and the snapshot republishes several times a second, so
 * one copy per project is the difference between a board and a bandwidth
 * problem. Only projects that actually contribute a card are recorded.
 */
export type DashboardProjectVisuals = {
  repoIconsByRepoId: Record<string, RepoIcon | null>
  repoBannersByRepoId: Record<string, RepoBanner>
  repoPathsByRepoId: Record<string, string>
}

export function recordProjectVisuals(
  workspace: ActiveDashboardWorkspace,
  visuals: DashboardProjectVisuals
): void {
  visuals.repoIconsByRepoId[workspace.projectId] = workspace.repoIcon
  if (workspace.repo?.repoBanner) {
    visuals.repoBannersByRepoId[workspace.projectId] = workspace.repo.repoBanner
  }
  // Why the path: the banner picker offers pictures the repo already contains,
  // and it needs somewhere to look for them.
  if (workspace.repo?.path) {
    visuals.repoPathsByRepoId[workspace.projectId] = workspace.repo.path
  }
}
