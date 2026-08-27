// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AgentCardActivity } from './AgentCardActivity'
import { resetCardPreviewSlots } from './card-preview-slots'

const connect = vi.fn()
const unsubscribe = vi.fn().mockResolvedValue(undefined)
const ack = vi.fn().mockResolvedValue(undefined)
const fit = vi.fn()
const onData = vi.fn().mockReturnValue(() => {})

let intersect: (() => void)[] = []

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  resetCardPreviewSlots()
  intersect = []
  connect.mockResolvedValue({ snapshot: null, replay: [] })
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(private readonly notify: (entries: { isIntersecting: boolean }[]) => void) {
        intersect.push(() => this.notify([{ isIntersecting: true }]))
      }
      observe(): void {}
      disconnect(): void {}
    }
  )
  Object.assign(window, { api: { terminalPreview: { connect, unsubscribe, ack, fit, onData } } })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

async function show(): Promise<void> {
  await act(async () => {
    intersect.forEach((notify) => notify())
  })
}

describe('AgentCardActivity', () => {
  it('subscribes to nothing until the card is on screen', () => {
    render(<AgentCardActivity ptyId="pty-1" />)

    expect(connect).not.toHaveBeenCalled()
  })

  it('never claims the PTY grid — that would resize the agent\u2019s real terminal', async () => {
    render(<AgentCardActivity ptyId="pty-1" />)
    await show()

    expect(connect).toHaveBeenCalledOnce()
    expect(fit).not.toHaveBeenCalled()
  })

  it('shows the readable tail of what the agent printed', async () => {
    connect.mockResolvedValue({
      snapshot: {
        data: [
          '\u256d\u2500\u2500\u256e',
          '\u2502 Editing src/app.ts \u2502',
          '\u2570\u2500\u2500\u256f'
        ].join('\n'),
        cols: 80,
        rows: 24
      },
      replay: []
    })
    render(<AgentCardActivity ptyId="pty-1" />)
    await show()

    expect(screen.getByText('Editing src/app.ts')).toBeInTheDocument()
    // The frame the agent drew around it is not information.
    expect(screen.queryByText(/\u2502/)).not.toBeInTheDocument()
  })

  it('shows nothing at all when the screen carries no words', async () => {
    connect.mockResolvedValue({
      snapshot: { data: '\u2570\u2500\u2500\u256f', cols: 80, rows: 24 },
      replay: []
    })
    const { container } = render(<AgentCardActivity ptyId="pty-1" />)
    await show()

    expect(container.textContent).toBe('')
  })

  it('releases the subscription when the card unmounts', async () => {
    const { unmount } = render(<AgentCardActivity ptyId="pty-1" />)
    await show()
    unmount()

    expect(unsubscribe).toHaveBeenCalledWith('pty-1')
  })
})
