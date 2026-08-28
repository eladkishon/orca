import { describe, expect, it } from 'vitest'
import { chooseUsageLimitFallbackAccount } from './usage-limit-account-fallback'

const ACCOUNTS = [
  { id: 'b', label: 'work@example.test' },
  { id: 'a', label: 'me@example.test' },
  { id: 'c', label: 'spare@example.test' }
]

describe('chooseUsageLimitFallbackAccount', () => {
  it('moves to another account when the active one is spent', () => {
    expect(
      chooseUsageLimitFallbackAccount({
        accounts: ACCOUNTS,
        activeAccountId: 'a',
        triedAccountIds: []
      })
    ).toEqual({ kind: 'switch', accountId: 'b', label: 'work@example.test' })
  })

  it('never returns to an account already tried against this limit', () => {
    expect(
      chooseUsageLimitFallbackAccount({
        accounts: ACCOUNTS,
        activeAccountId: 'b',
        triedAccountIds: ['a']
      })
    ).toEqual({ kind: 'switch', accountId: 'c', label: 'spare@example.test' })
  })

  it('stops once every account has been tried, rather than cycling', () => {
    // Cycling would burn every account against what is really a provider-wide
    // outage, and would keep doing it.
    expect(
      chooseUsageLimitFallbackAccount({
        accounts: ACCOUNTS,
        activeAccountId: 'a',
        triedAccountIds: ['b', 'c']
      })
    ).toEqual({ kind: 'exhausted' })
  })

  it('has nothing to offer with a single account', () => {
    expect(
      chooseUsageLimitFallbackAccount({
        accounts: [ACCOUNTS[0]],
        activeAccountId: 'b',
        triedAccountIds: []
      })
    ).toEqual({ kind: 'none' })
  })

  it('picks the same account on every machine, so a fallback is reproducible', () => {
    const shuffled = [ACCOUNTS[2], ACCOUNTS[0], ACCOUNTS[1]]

    expect(
      chooseUsageLimitFallbackAccount({
        accounts: shuffled,
        activeAccountId: null,
        triedAccountIds: []
      })
    ).toEqual({ kind: 'switch', accountId: 'a', label: 'me@example.test' })
  })
})
