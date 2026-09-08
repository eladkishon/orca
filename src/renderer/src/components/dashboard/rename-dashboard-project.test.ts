import { describe, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import { renameDashboardProject } from './rename-dashboard-project'

describe('renameDashboardProject', () => {
  it('routes a folder-workspace column to its project group and a repo column to the repo', async () => {
    const updateRepo = vi.fn().mockResolvedValue(true)
    const updateProjectGroup = vi.fn().mockResolvedValue(true)
    vi.spyOn(useAppStore, 'getState').mockReturnValue({
      updateRepo,
      updateProjectGroup
    } as unknown as ReturnType<typeof useAppStore.getState>)

    await renameDashboardProject('repo-1', '  Orca  ')
    await renameDashboardProject('folder-workspace:group-1', 'Notes')
    await renameDashboardProject('repo-1', '   ')

    expect(updateRepo).toHaveBeenCalledExactlyOnceWith('repo-1', {
      displayName: 'Orca'
    })
    expect(updateProjectGroup).toHaveBeenCalledExactlyOnceWith('group-1', {
      name: 'Notes'
    })
  })
})
