import { describe, expect, it } from 'vitest'
import { canShowResetToBaseQuickAction } from './reset-worktree-to-base'

const primary = {
  isMainWorktree: true,
  isFolder: false,
  isDeleting: false,
  branch: 'feature/merged'
}

describe('canShowResetToBaseQuickAction', () => {
  it('offers the switch on any primary worktree, merged or not', () => {
    expect(canShowResetToBaseQuickAction(primary)).toBe(true)
  })

  it('stays off child worktrees, folders, deleting rows, and detached heads', () => {
    expect(canShowResetToBaseQuickAction({ ...primary, isMainWorktree: false })).toBe(false)
    expect(canShowResetToBaseQuickAction({ ...primary, isFolder: true })).toBe(false)
    expect(canShowResetToBaseQuickAction({ ...primary, isDeleting: true })).toBe(false)
    expect(canShowResetToBaseQuickAction({ ...primary, branch: '' })).toBe(false)
  })
})
