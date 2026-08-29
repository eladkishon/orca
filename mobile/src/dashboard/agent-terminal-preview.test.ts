import { describe, expect, it } from 'vitest'
import { applyPreviewTerminalEvent, pickAgentTerminalTab } from './agent-terminal-preview'

describe('pickAgentTerminalTab', () => {
  const tabs = [
    { id: 'a', type: 'browser', terminal: null },
    { id: 'b', type: 'terminal', terminal: 't-1', agentStatus: { paneKey: 'pane-1' } },
    { id: 'c', type: 'terminal', terminal: 't-2', agentStatus: { paneKey: 'pane-2' } }
  ]

  it('picks the tab running the card"s own agent', () => {
    expect(pickAgentTerminalTab(tabs, 'pane-2')?.terminal).toBe('t-2')
  })

  it('falls back to the first terminal when the pane is unknown', () => {
    expect(pickAgentTerminalTab(tabs, 'pane-gone')?.terminal).toBe('t-1')
    expect(pickAgentTerminalTab([{ id: 'a', type: 'browser' }], 'pane-1')).toBeNull()
  })
})

describe('applyPreviewTerminalEvent', () => {
  it('initializes from scrollback and writes live output', () => {
    const calls: string[] = []
    const sink = {
      init: (cols: number, rows: number, data?: string) =>
        calls.push(`init ${cols}x${rows} ${data}`),
      write: (chunk: string) => calls.push(`write ${chunk}`)
    }
    applyPreviewTerminalEvent({ type: 'scrollback', cols: 120, rows: 40, serialized: 'hi' }, sink)
    applyPreviewTerminalEvent({ type: 'data', chunk: 'ok' }, sink)
    applyPreviewTerminalEvent({ type: 'resized' }, sink)
    expect(calls).toEqual(['init 120x40 hi', 'write ok'])
  })
})
