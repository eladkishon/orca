import { describe, expect, it, vi } from 'vitest'
import { settleWithinDeadline } from './settle-within-deadline'

describe('settleWithinDeadline', () => {
  it('returns the value when the work finishes in time', async () => {
    expect(await settleWithinDeadline(Promise.resolve('done'), 50)).toEqual({
      settled: true,
      value: 'done'
    })
  })

  it('returns the failure when the work fails in time', async () => {
    const error = new Error('refused')

    expect(await settleWithinDeadline(Promise.reject(error), 50)).toEqual({ settled: true, error })
  })

  it('gives up waiting once the deadline passes', async () => {
    const never = new Promise<string>(() => {})

    expect(await settleWithinDeadline(never, 1)).toEqual({ settled: false })
  })

  it('does not leave an unhandled rejection behind after giving up', async () => {
    const unhandled = vi.fn()
    process.on('unhandledRejection', unhandled)
    let fail: (error: unknown) => void = () => {}
    const slow = new Promise<string>((_resolve, reject) => {
      fail = reject
    })

    expect(await settleWithinDeadline(slow, 1)).toEqual({ settled: false })
    fail(new Error('late failure'))
    await new Promise((resolve) => setTimeout(resolve, 10))
    process.off('unhandledRejection', unhandled)

    expect(unhandled).not.toHaveBeenCalled()
  })
})
