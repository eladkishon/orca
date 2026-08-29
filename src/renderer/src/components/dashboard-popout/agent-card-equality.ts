import type { DashboardCard } from '../../../../shared/dashboard-snapshot'

/**
 * What counts as "the same card" for the memoized board row.
 *
 * A dashboard snapshot republishes several times a second with fresh object
 * identities, so every card would re-render on every tick without a field-level
 * comparison. Kept beside the card rather than inside it — this is a long list
 * that grows with the contract, and it buries the component it guards.
 */

function sameSubagents(a: DashboardCard['subagents'], b: DashboardCard['subagents']): boolean {
  if (a === b) {
    return true
  }
  if (!a || !b || a.length !== b.length) {
    return false
  }
  for (let index = 0; index < a.length; index += 1) {
    if (!(index in a) || !(index in b)) {
      if (index in a !== index in b) {
        return false
      }
      continue
    }
    const subagent = a[index]
    const other = b[index]
    if (
      subagent.id !== other.id ||
      subagent.name !== other.name ||
      subagent.dotState !== other.dotState
    ) {
      return false
    }
  }
  return true
}

export function sameCard(a: DashboardCard, b: DashboardCard): boolean {
  return (
    a.paneKey === b.paneKey &&
    a.ptyId === b.ptyId &&
    a.agentType === b.agentType &&
    a.bucket === b.bucket &&
    a.dotState === b.dotState &&
    a.workingMode === b.workingMode &&
    a.task === b.task &&
    a.activity === b.activity &&
    a.recentCommands?.length === b.recentCommands?.length &&
    a.recentCommands?.at(-1) === b.recentCommands?.at(-1) &&
    a.lastUserMessage === b.lastUserMessage &&
    a.titleFromPrompt === b.titleFromPrompt &&
    a.lastAgentMessage === b.lastAgentMessage &&
    a.repoId === b.repoId &&
    a.worktreeId === b.worktreeId &&
    a.tabId === b.tabId &&
    a.leafId === b.leafId &&
    a.repoName === b.repoName &&
    a.worktreeName === b.worktreeName &&
    a.hostKind === b.hostKind &&
    a.executionHostId === b.executionHostId &&
    a.hostLabel === b.hostLabel &&
    a.hasReview === b.hasReview &&
    a.isMainWorktree === b.isMainWorktree &&
    a.review?.number === b.review?.number &&
    a.review?.state === b.review?.state &&
    a.review?.checksStatus === b.review?.checksStatus &&
    a.review?.url === b.review?.url &&
    a.linearIssue?.identifier === b.linearIssue?.identifier &&
    a.linearIssue?.url === b.linearIssue?.url &&
    sameSubagents(a.subagents, b.subagents) &&
    sameTouchpoints(a.touchpoints, b.touchpoints) &&
    a.startedAt === b.startedAt &&
    a.finishedAt === b.finishedAt &&
    a.stateChangedAt === b.stateChangedAt &&
    a.unseen === b.unseen &&
    a.askSummary === b.askSummary &&
    a.conversationName === b.conversationName
  )
}

/** kind + target is the whole identity of a chip. */
function sameTouchpoints(
  a: DashboardCard['touchpoints'],
  b: DashboardCard['touchpoints']
): boolean {
  if (a === b) {
    return true
  }
  if (!a || !b || a.length !== b.length) {
    return false
  }
  return a.every((touchpoint, index) => {
    const other = b[index]
    return touchpoint.kind === other?.kind && touchpoint.url === other.url
  })
}
