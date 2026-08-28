/**
 * Picks the account to fall back to when a session hits its usage limit.
 *
 * Orca tracks usage per PROVIDER, not per account, so nothing here can know
 * which of your accounts still has quota. What it can know is which ones have
 * already been tried since the limit began — so the rule is a rotation with a
 * memory, not a guess at who is fresh: try each account once, in a stable
 * order, and stop rather than cycle. Cycling would burn every account against
 * a limit that is really a provider-wide outage, and would do it repeatedly.
 *
 * The order is by id so a fallback is reproducible: the same limit picks the
 * same next account on every machine, which matters when you are trying to
 * work out where a session actually ran.
 */

export type UsageLimitAccount = {
  id: string
  /** Shown when the switch is announced, so the user knows where work moved. */
  label: string
}

export type UsageLimitFallback =
  | { kind: 'switch'; accountId: string; label: string }
  | { kind: 'exhausted' }
  | { kind: 'none' }

export function chooseUsageLimitFallbackAccount(args: {
  accounts: readonly UsageLimitAccount[]
  activeAccountId: string | null
  /** Accounts already tried against this limit, including the active one. */
  triedAccountIds: readonly string[]
}): UsageLimitFallback {
  // Why: one account is not a fallback, it is the account you are already on.
  if (args.accounts.length < 2) {
    return { kind: 'none' }
  }
  const tried = new Set(args.triedAccountIds)
  if (args.activeAccountId) {
    tried.add(args.activeAccountId)
  }
  const candidate = [...args.accounts]
    .sort((first, second) => first.id.localeCompare(second.id))
    .find((account) => !tried.has(account.id))
  return candidate
    ? { kind: 'switch', accountId: candidate.id, label: candidate.label }
    : { kind: 'exhausted' }
}
