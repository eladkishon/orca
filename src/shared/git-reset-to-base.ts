// Why: main and the relay both refuse the reset, and the message reaches the same toast.
export const RESET_TO_BASE_DIRTY_WORKTREE_ERROR =
  'Reset needs a clean worktree: commit, stash, or discard your changes first.'

/** Name what is dirty — otherwise the refusal sends you hunting for it. */
export function describeResetToBaseDirtyWorktree(porcelain: string): string {
  const paths = porcelain
    .split('\n')
    .map((line) => line.slice(3).trim())
    .filter(Boolean)
  if (paths.length === 0) {
    return RESET_TO_BASE_DIRTY_WORKTREE_ERROR
  }
  const shown = paths.slice(0, 3).join(', ')
  const rest = paths.length > 3 ? `, +${paths.length - 3} more` : ''
  return `${RESET_TO_BASE_DIRTY_WORKTREE_ERROR} (${shown}${rest})`
}

/** Lets the caller offer "stash and retry" instead of a dead end. */
export function isResetToBaseDirtyWorktreeError(message: string): boolean {
  return message.includes(RESET_TO_BASE_DIRTY_WORKTREE_ERROR)
}

export function buildResetToBaseStashMessage(baseRef: string): string {
  return `orca: before reset to ${baseRef}`
}
