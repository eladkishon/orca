import { useAppStore } from '@/store'

/** Board columns key on a repo id, except folder-workspace groups, which carry
 *  their project-group id behind this prefix (see dashboard-snapshot-workspaces). */
const FOLDER_WORKSPACE_PROJECT_PREFIX = 'folder-workspace:'

/** Renames the project a board column names, whichever kind it is. */
export async function renameDashboardProject(projectId: string, name: string): Promise<void> {
  const trimmed = name.trim()
  if (!trimmed) {
    return
  }
  const store = useAppStore.getState()
  if (projectId.startsWith(FOLDER_WORKSPACE_PROJECT_PREFIX)) {
    await store.updateProjectGroup(projectId.slice(FOLDER_WORKSPACE_PROJECT_PREFIX.length), {
      name: trimmed
    })
    return
  }
  await store.updateRepo(projectId, { displayName: trimmed })
}
