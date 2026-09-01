import { toast } from 'sonner'
import { getConnectionId } from '@/lib/connection-context'
import { extractIpcErrorMessage } from '@/lib/ipc-error-message'
import { translate } from '@/i18n/i18n'
import { resetRuntimeGitToBase } from '@/runtime/runtime-git-client'
import { getRuntimeRepoBaseRefDefault } from '@/runtime/runtime-repo-client'
import { useAppStore } from '@/store'
import { findRepoForHost } from '@/store/slices/repo-host-identity'
import { getRepoExecutionHostId } from '../../../../shared/execution-host'
import { isResetToBaseDirtyWorktreeError } from '../../../../shared/git-reset-to-base'
import type { Worktree } from '../../../../shared/worktree/types'

/**
 * Offered on a primary worktree whose review is merged: leave the merged branch behind and
 * put the checkout back on the project's default branch at origin's latest commit.
 */
export function confirmResetWorktreeToBase(worktree: Worktree, branchLabel: string): void {
  toast.warning(
    translate(
      'auto.components.sidebar.resetWorktreeToBase.confirmTitle',
      'Switch off {{branch}} to the default branch?',
      { branch: branchLabel }
    ),
    {
      description: translate(
        'auto.components.sidebar.resetWorktreeToBase.confirmDescription',
        "Checks out the project's default branch at origin's latest commit. {{branch}} itself is left alone. Uncommitted changes block the switch.",
        { branch: branchLabel }
      ),
      duration: 10_000,
      action: {
        label: translate('auto.components.sidebar.resetWorktreeToBase.confirmAction', 'Switch'),
        onClick: () => {
          void resetWorktreeToBase(worktree, branchLabel)
        }
      }
    }
  )
}

async function resetWorktreeToBase(
  worktree: Worktree,
  branchLabel: string,
  stashChanges = false
): Promise<void> {
  const state = useAppStore.getState()
  const repo = findRepoForHost(state.repos, worktree.repoId, {
    hostId: worktree.hostId,
    settings: state.settings
  })
  const hostId = repo ? getRepoExecutionHostId(repo) : undefined
  const toastId = `reset-worktree-to-base:${worktree.id}`
  toast.loading(
    translate(
      'auto.components.sidebar.resetWorktreeToBase.running',
      'Switching to the default branch...'
    ),
    { id: toastId }
  )
  try {
    const { defaultBaseRef } = await getRuntimeRepoBaseRefDefault(
      state.settings,
      worktree.repoId,
      hostId ?? undefined
    )
    if (!defaultBaseRef) {
      throw new Error(
        translate(
          'auto.components.sidebar.resetWorktreeToBase.noBaseRef',
          'No main or master branch found for this project.'
        )
      )
    }
    await resetRuntimeGitToBase(
      {
        settings: state.settings,
        worktreeId: worktree.id,
        worktreePath: worktree.path,
        connectionId: getConnectionId(worktree.id) ?? undefined
      },
      defaultBaseRef,
      { stashChanges }
    )
    toast.success(
      translate('auto.components.sidebar.resetWorktreeToBase.succeeded', 'Now on {{baseRef}}', {
        baseRef: defaultBaseRef.replace(/^[^/]+\//, '')
      }),
      {
        id: toastId,
        ...(stashChanges
          ? {
              duration: 12_000,
              description: translate(
                'auto.components.sidebar.resetWorktreeToBase.stashed',
                'Your uncommitted changes are in a stash — run git stash pop to bring them back.'
              )
            }
          : {})
      }
    )
  } catch (error) {
    const message = extractIpcErrorMessage(
      error,
      translate(
        'auto.components.sidebar.resetWorktreeToBase.unknownError',
        'The reset did not complete.'
      )
    )
    // Why the offer: the refusal is the only failure the user can clear from here, and a stash is recoverable.
    const canStash = !stashChanges && isResetToBaseDirtyWorktreeError(message)
    toast.error(translate('auto.components.sidebar.resetWorktreeToBase.failed', 'Switch failed'), {
      id: toastId,
      duration: canStash ? 20_000 : 12_000,
      description: message,
      ...(canStash
        ? {
            action: {
              label: translate(
                'auto.components.sidebar.resetWorktreeToBase.stashAction',
                'Stash & switch'
              ),
              onClick: () => {
                void resetWorktreeToBase(worktree, branchLabel, true)
              }
            }
          }
        : {})
    })
  }
}

/**
 * The primary checkout is the one that keeps living after its branch merges; children get
 * deleted instead. Not gated on a merged review: wanting the default branch back is a standing
 * wish, not something that only becomes true the moment a PR lands.
 */
export function canShowResetToBaseQuickAction(args: {
  isMainWorktree: boolean
  isFolder: boolean
  isDeleting: boolean
  branch: string
}): boolean {
  return args.isMainWorktree && !args.isFolder && !args.isDeleting && args.branch.length > 0
}
