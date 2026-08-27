import { describe, expect, it } from 'vitest'
import { previewTerminalSwallowsKey } from './preview-terminal-escape-guard'

function key(init: Partial<KeyboardEvent> & { key: string }): KeyboardEvent {
  return {
    type: 'keydown',
    ctrlKey: false,
    altKey: false,
    metaKey: false,
    shiftKey: false,
    ...init
  } as KeyboardEvent
}

describe('previewTerminalSwallowsKey', () => {
  it('keeps a bare Escape from interrupting the agent', () => {
    expect(previewTerminalSwallowsKey(key({ key: 'Escape' }))).toBe(true)
  })

  it('still lets Ctrl+C through, since that is the interrupt now', () => {
    expect(previewTerminalSwallowsKey(key({ key: 'c', ctrlKey: true }))).toBe(false)
  })

  it('leaves a modified Escape alone — only the bare key is overloaded', () => {
    expect(previewTerminalSwallowsKey(key({ key: 'Escape', altKey: true }))).toBe(false)
    expect(previewTerminalSwallowsKey(key({ key: 'Escape', shiftKey: true }))).toBe(false)
  })

  it('ignores keyup, so the guard fires once per press', () => {
    expect(previewTerminalSwallowsKey(key({ key: 'Escape', type: 'keyup' }))).toBe(false)
  })
})
