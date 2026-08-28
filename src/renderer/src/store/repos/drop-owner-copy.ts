/**
 * Drops a project from the machine that owns it, as far as that machine allows.
 *
 * Split out so the removal reducer reads as the sequence it is; the rules here
 * are their own subject. Two of them matter:
 *
 * A host that ANSWERS with an error has decided something — "I cannot tell
 * which row you mean" — and that decision stands. A host that never answers has
 * decided nothing; removing a project is local bookkeeping, and the dialog says
 * so in as many words ("This only removes it from Orca; its files stay on the
 * host"), so silence must not strand the row in a sidebar that only the
 * unreachable machine could ever clear.
 *
 * And the waiting is bounded. A reachable host answers in milliseconds, so the
 * deadline costs it nothing, while a sleeping one used to hold the row on
 * screen for the transport's full timeout with nothing to show for it.
 */

import { toast } from 'sonner'
import { callRuntimeRpc, hasRuntimeRpcErrorCode } from '../../runtime/runtime-rpc-client'
import type { getActiveRuntimeTarget } from '../../runtime/runtime-rpc-client'
import { isUnansweredRuntimeRpcFailure } from '../../../../shared/runtime-rpc-unanswered'
import { settleWithinDeadline } from '../../../../shared/settle-within-deadline'
import { translate } from '@/i18n/i18n'

/** Long enough for any host that is actually up to answer. */
const UNREACHABLE_OWNER_DEADLINE_MS = 2_500

export async function dropOwnerCopy(args: {
  target: ReturnType<typeof getActiveRuntimeTarget>
  projectId: string
  ownerHostId: string
  idExistsOnOtherHost: boolean
  displayName: string
  onPending: (toastId: string | number) => void
}): Promise<{ unreachableOwner: boolean }> {
  const { target, projectId, ownerHostId } = args
  if (target.kind === 'local') {
    await (args.idExistsOnOtherHost
      ? window.api.repos.removeForHost({ repoId: projectId, hostId: ownerHostId })
      : window.api.repos.remove({ repoId: projectId }))
    return { unreachableOwner: false }
  }

  // Why: the row stays on screen until the removal finishes, so say the work
  // started rather than leaving the user to wonder whether the click landed.
  args.onPending(
    toast.loading(
      translate('auto.store.slices.repos.removingProject', 'Removing {{name}}…', {
        name: args.displayName
      })
    )
  )
  const outcome = await settleWithinDeadline(
    callRuntimeRpc(target, 'repo.rm', { repo: projectId }, { timeoutMs: 15_000 }),
    UNREACHABLE_OWNER_DEADLINE_MS
  )
  if (!outcome.settled) {
    console.warn('Remote project removal is still pending; removing locally.')
    return { unreachableOwner: true }
  }
  if (!('error' in outcome)) {
    return { unreachableOwner: false }
  }
  const error = outcome.error
  // Why: the owner already dropped this project, so purge the local ghost row instead of aborting (#11994).
  if (hasRuntimeRpcErrorCode(error, 'repo_not_found')) {
    return { unreachableOwner: false }
  }
  if (!isUnansweredRuntimeRpcFailure(error)) {
    throw error
  }
  console.error('Remote project removal failed; removing locally:', error)
  return { unreachableOwner: true }
}
