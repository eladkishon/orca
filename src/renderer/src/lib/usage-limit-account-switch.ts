/**
 * Moves to another account of the same provider when a session hits its usage
 * limit, and continues the agents that limit stopped.
 *
 * The decision is here; the mechanics are the provider's existing account
 * switcher and the existing stall recovery. Nothing new talks to a CLI.
 *
 * One honest limit, stated where it will be read: switching swaps the auth the
 * provider's CLI reads, and Orca's own account switcher warns that live
 * terminals should be restarted before continuing old sessions. Recovery
 * prompts the existing pane rather than restarting it, so an agent whose CLI
 * holds its credentials for the life of the process will stall again — and be
 * caught by the same backoff ladder, having cost one attempt. That is the
 * conservative failure: it retries, it does not restart an agent's terminal
 * out from under it.
 */

import { toast } from 'sonner'
import { useAppStore, type AppState } from '@/store'
import { recoverStalledAgentPanes } from '@/lib/recover-stalled-agent-panes'
import { translate } from '@/i18n/i18n'
import {
  chooseUsageLimitFallbackAccount,
  type UsageLimitAccount
} from '../../../shared/usage-limit-account-fallback'
import { rateLimitProviderForAgentType } from '../../../shared/agent-stall-rate-limit-provider'

/** Providers whose accounts Orca can actually switch between. */
export type SwitchableAccountProvider = 'claude' | 'codex'

type ProviderAccountsState = {
  accounts: readonly { id: string; email?: string; label?: string }[]
  activeAccountId: string | null
}

type AccountPort = {
  list: () => Promise<unknown>
  select: (args: { accountId: string | null }) => Promise<unknown>
}

function accountPort(provider: SwitchableAccountProvider): AccountPort | undefined {
  const api = provider === 'claude' ? window.api.claudeAccounts : window.api.codexAccounts
  return api as AccountPort | undefined
}

function toAccounts(state: ProviderAccountsState): UsageLimitAccount[] {
  return state.accounts.map((account) => ({
    id: account.id,
    label: account.email ?? account.label ?? account.id
  }))
}

/** Accounts already spent against the CURRENT limit, per provider. Cleared the
 *  moment that provider stops reporting a rate-limit stall, so a limit tomorrow
 *  starts from a clean rotation rather than inheriting today's exhaustion. */
const triedByProvider = new Map<SwitchableAccountProvider, Set<string>>()

export function forgetUsageLimitAttempts(provider?: SwitchableAccountProvider): void {
  if (provider) {
    triedByProvider.delete(provider)
    return
  }
  triedByProvider.clear()
}

/** Providers with at least one agent stalled on a usage limit right now. */
export function providersStalledOnUsageLimit(
  state: Pick<AppState, 'agentStallByPaneKey' | 'agentStatusByPaneKey'>
): SwitchableAccountProvider[] {
  const providers = new Set<SwitchableAccountProvider>()
  for (const observation of Object.values(state.agentStallByPaneKey)) {
    if (observation.cause !== 'rate-limit') {
      continue
    }
    const agentType = state.agentStatusByPaneKey[observation.paneKey]?.agentType
    const provider = agentType ? rateLimitProviderForAgentType(agentType) : null
    if (provider === 'claude' || provider === 'codex') {
      providers.add(provider)
    }
  }
  return [...providers]
}

/**
 * Switches `provider` to its next untried account and continues the agents its
 * limit stopped. Returns whether a switch actually happened.
 */
export async function switchAccountForUsageLimit(
  provider: SwitchableAccountProvider
): Promise<boolean> {
  const port = accountPort(provider)
  if (!port) {
    return false
  }
  let state: ProviderAccountsState
  try {
    state = (await port.list()) as ProviderAccountsState
  } catch (error) {
    console.warn(`[usage-limit] could not read ${provider} accounts:`, error)
    return false
  }
  if (!state?.accounts) {
    return false
  }
  const tried = triedByProvider.get(provider) ?? new Set<string>()
  const fallback = chooseUsageLimitFallbackAccount({
    accounts: toAccounts(state),
    activeAccountId: state.activeAccountId,
    triedAccountIds: [...tried]
  })
  if (fallback.kind !== 'switch') {
    // Why silent: "you only have one account" and "every account is spent" are
    // both states the user cannot act on from a toast, and this fires off the
    // back of an agent stalling — it must not become a notification loop.
    return false
  }
  if (state.activeAccountId) {
    tried.add(state.activeAccountId)
  }
  tried.add(fallback.accountId)
  triedByProvider.set(provider, tried)

  try {
    await port.select({ accountId: fallback.accountId })
  } catch (error) {
    console.warn(`[usage-limit] could not switch ${provider} account:`, error)
    return false
  }
  toast.info(
    translate('usageLimit.switchedAccount', 'Usage limit — switched to {{account}}', {
      account: fallback.label
    }),
    {
      description: translate(
        'usageLimit.switchedAccountDescription',
        'Continuing the agents that were waiting. Restart a terminal if it stays stuck.'
      )
    }
  )
  // Why force: the limit is the reason these panes are stalled, and the account
  // that caused it is no longer the active one — waiting out a backoff written
  // for "try again later" would waste the switch.
  await recoverStalledAgentPanes({ force: true, causes: ['rate-limit'] })
  return true
}

/**
 * Watches for agents stalling on a usage limit and switches the account under
 * them, once per provider per limit.
 *
 * Subscribed rather than polled: the stall map is the signal, and it already
 * updates the moment an agent reports a limit.
 */
export function installUsageLimitAccountSwitch(): () => void {
  let running = false
  return useAppStore.subscribe((state, previous) => {
    if (state.agentStallByPaneKey === previous.agentStallByPaneKey) {
      return
    }
    const stalled = providersStalledOnUsageLimit(state)
    // Why: a provider that is no longer limited starts its rotation over, so a
    // limit next week does not inherit this week's exhausted set.
    for (const provider of ['claude', 'codex'] as const) {
      if (!stalled.includes(provider)) {
        forgetUsageLimitAttempts(provider)
      }
    }
    if (state.settings?.autoSwitchAccountOnUsageLimit !== true || stalled.length === 0) {
      return
    }
    if (running) {
      return
    }
    running = true
    void (async () => {
      try {
        for (const provider of stalled) {
          await switchAccountForUsageLimit(provider)
        }
      } finally {
        running = false
      }
    })()
  })
}
