// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest'

const { recoverStalledAgentPanes } = vi.hoisted(() => ({
  recoverStalledAgentPanes: vi.fn(async () => [])
}))
vi.mock('@/lib/recover-stalled-agent-panes', () => ({ recoverStalledAgentPanes }))
vi.mock('sonner', () => ({ toast: { info: vi.fn(), error: vi.fn() } }))
vi.mock('@/store', () => ({ useAppStore: { subscribe: vi.fn(), getState: vi.fn() } }))

import {
  forgetUsageLimitAttempts,
  providersStalledOnUsageLimit,
  switchAccountForUsageLimit
} from './usage-limit-account-switch'

const select = vi.fn(async () => ({}))
const list = vi.fn()

function accounts(activeAccountId: string | null): unknown {
  return {
    activeAccountId,
    accounts: [
      { id: 'a', email: 'me@example.test' },
      { id: 'b', email: 'work@example.test' }
    ]
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  forgetUsageLimitAttempts()
  list.mockResolvedValue(accounts('a'))
  Object.assign(window, {
    api: { claudeAccounts: { list, select }, codexAccounts: { list, select } }
  })
})

describe('providersStalledOnUsageLimit', () => {
  it('reports only providers whose agents stopped on a usage limit', () => {
    const state = {
      agentStallByPaneKey: {
        p1: { paneKey: 'p1', cause: 'rate-limit' },
        p2: { paneKey: 'p2', cause: 'auth' }
      },
      agentStatusByPaneKey: { p1: { agentType: 'claude' }, p2: { agentType: 'codex' } }
    } as never

    expect(providersStalledOnUsageLimit(state)).toEqual(['claude'])
  })

  it('ignores providers whose accounts Orca cannot switch', () => {
    const state = {
      agentStallByPaneKey: { p1: { paneKey: 'p1', cause: 'rate-limit' } },
      agentStatusByPaneKey: { p1: { agentType: 'gemini' } }
    } as never

    expect(providersStalledOnUsageLimit(state)).toEqual([])
  })
})

describe('switchAccountForUsageLimit', () => {
  it('switches to another account and continues the waiting agents', async () => {
    expect(await switchAccountForUsageLimit('claude')).toBe(true)
    expect(select).toHaveBeenCalledWith({ accountId: 'b' })
    // Force: the account that caused the limit is no longer the active one, so
    // waiting out a "try again later" backoff would waste the switch.
    expect(recoverStalledAgentPanes).toHaveBeenCalledWith({
      force: true,
      causes: ['rate-limit']
    })
  })

  it('tries each account once, then stops rather than cycling', async () => {
    expect(await switchAccountForUsageLimit('claude')).toBe(true)
    list.mockResolvedValue(accounts('b'))

    expect(await switchAccountForUsageLimit('claude')).toBe(false)
    expect(select).toHaveBeenCalledTimes(1)
  })

  it('starts a clean rotation once the limit is behind it', async () => {
    await switchAccountForUsageLimit('claude')
    list.mockResolvedValue(accounts('b'))
    forgetUsageLimitAttempts('claude')

    expect(await switchAccountForUsageLimit('claude')).toBe(true)
    expect(select).toHaveBeenLastCalledWith({ accountId: 'a' })
  })

  it('does nothing with a single account', async () => {
    list.mockResolvedValue({ activeAccountId: 'a', accounts: [{ id: 'a', email: 'me' }] })

    expect(await switchAccountForUsageLimit('claude')).toBe(false)
    expect(recoverStalledAgentPanes).not.toHaveBeenCalled()
  })

  it('continues nothing when the switch itself fails', async () => {
    select.mockRejectedValueOnce(new Error('locked'))

    expect(await switchAccountForUsageLimit('claude')).toBe(false)
    expect(recoverStalledAgentPanes).not.toHaveBeenCalled()
  })

  it('survives a provider that cannot list its accounts', async () => {
    list.mockRejectedValueOnce(new Error('offline'))

    expect(await switchAccountForUsageLimit('claude')).toBe(false)
  })
})
