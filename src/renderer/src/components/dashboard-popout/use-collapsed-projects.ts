import { useCallback, useMemo, useState } from 'react'

/**
 * Which project columns are folded to a spine.
 *
 * Board-local and not persisted: collapsing a project is "not now", the same
 * kind of choice as a filter — it should not follow you into tomorrow's
 * session.
 */
export function useCollapsedProjects(projectIds: readonly string[]): {
  isCollapsed: (projectId: string) => boolean
  toggleCollapsed: (projectId: string) => void
  /** Parallel to `projectIds`. Identity matters: the split writes pane flex
   *  from an effect keyed on it. */
  collapsedFlags: readonly boolean[]
} {
  const [collapsed, setCollapsed] = useState<readonly string[]>([])
  const toggleCollapsed = useCallback((projectId: string) => {
    setCollapsed((current) =>
      current.includes(projectId)
        ? current.filter((id) => id !== projectId)
        : [...current, projectId]
    )
  }, [])
  // Why a joined key: the caller rebuilds the id array every render, so the
  // memo has to depend on what is in it rather than on the array itself.
  const key = projectIds.join('|')
  const collapsedFlags = useMemo(
    () => key.split('|').map((projectId) => collapsed.includes(projectId)),
    [key, collapsed]
  )
  return {
    isCollapsed: (projectId: string) => collapsed.includes(projectId),
    toggleCollapsed,
    collapsedFlags
  }
}
