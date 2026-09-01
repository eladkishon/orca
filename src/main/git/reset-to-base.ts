import { normalizeGitErrorMessage } from '../../shared/git-remote-error'
import {
  REBASE_SOURCE_FETCH_TIMEOUT_MS,
  resolveGitRemoteRebaseSource
} from '../../shared/git-rebase-source'
import {
  buildResetToBaseStashMessage,
  describeResetToBaseDirtyWorktree
} from '../../shared/git-reset-to-base'
import { runWithGitWorktreeOperationLock } from '../../shared/git-worktree-operation-lock'
import type { GitRuntimeOptions } from './git-runtime-options'
import { gitOptionsForWorktree } from './git-runtime-options'
import { gitExecFileAsync } from './runner'
import { runWithGitReadCacheInvalidation } from './status'

/**
 * Put the worktree back on the project's default branch at the freshly fetched remote tip
 * (`origin/main`), leaving the merged branch behind untouched.
 * Refuses on a dirty worktree — uncommitted work is the one thing this cannot give back.
 */
export type GitResetToBaseOptions = GitRuntimeOptions & {
  /** Park uncommitted tracked changes in a stash instead of refusing. */
  stashChanges?: boolean
}

export async function gitResetToBase(
  worktreePath: string,
  baseRef: string,
  options: GitResetToBaseOptions = {}
): Promise<void> {
  await runWithGitWorktreeOperationLock(worktreePath, options.signal, () =>
    runWithGitReadCacheInvalidation(() => resetToBaseUnlocked(worktreePath, baseRef, options))
  )
}

async function resetToBaseUnlocked(
  worktreePath: string,
  baseRef: string,
  options: GitResetToBaseOptions
): Promise<void> {
  const execOptions = {
    ...gitOptionsForWorktree(worktreePath, options),
    terminationBarrier: true,
    captureWslLoginShellOutput: true
  }
  const { stdout: dirty } = await gitExecFileAsync(
    ['status', '--porcelain', '--untracked-files=no'],
    execOptions
  )
  if (dirty.trim()) {
    if (!options.stashChanges) {
      throw new Error(describeResetToBaseDirtyWorktree(dirty))
    }
    // Why stash and not discard: the reset is already irreversible for commits; the working tree stays recoverable.
    await gitExecFileAsync(
      ['stash', 'push', '--message', buildResetToBaseStashMessage(baseRef)],
      execOptions
    )
  }
  try {
    // A local-only base (no matching remote) is switched to as-is instead of fetching.
    const source = await resolveGitRemoteRebaseSource(
      (args) => gitExecFileAsync(args, execOptions),
      baseRef
    ).catch(() => null)
    if (!source) {
      await gitExecFileAsync(['rev-parse', '--verify', `${baseRef}^{commit}`], execOptions)
      await gitExecFileAsync(['checkout', baseRef], execOptions)
      return
    }
    await gitExecFileAsync(
      [
        'fetch',
        source.remoteName,
        `+refs/heads/${source.branchName}:refs/remotes/${source.displayName}`
      ],
      { ...execOptions, timeout: REBASE_SOURCE_FETCH_TIMEOUT_MS }
    )
    const remoteRef = `refs/remotes/${source.displayName}`
    await gitExecFileAsync(['rev-parse', '--verify', `${remoteRef}^{commit}`], execOptions)
    // Why -B and not `reset --hard`: the point is to END UP ON the default branch, not to leave the
    // merged branch impersonating it. -B also creates the local branch when this checkout never had
    // it, and refuses outright when another worktree holds it.
    await gitExecFileAsync(['checkout', '-B', source.branchName, remoteRef], execOptions)
  } catch (error) {
    throw new Error(normalizeGitErrorMessage(error, 'fetch'))
  }
}
