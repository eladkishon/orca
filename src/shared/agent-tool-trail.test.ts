import { describe, expect, it } from 'vitest'
import { AGENT_TOOL_TRAIL_MAX, appendAgentToolUse } from './agent-tool-trail'

describe('appendAgentToolUse', () => {
  it('records a tool call', () => {
    expect(appendAgentToolUse(undefined, 'Bash: pnpm test', 10)).toEqual([
      { label: 'Bash: pnpm test', at: 10 }
    ])
  })

  it('ignores a repeat of the call already at the head', () => {
    // Agents re-report the same tool on every status ping; without this the
    // trail would be six copies of one command.
    const history = [{ label: 'Bash: pnpm test', at: 10 }]

    expect(appendAgentToolUse(history, 'Bash: pnpm test', 20)).toBe(history)
  })

  it('records the same tool again once something else happened between', () => {
    const history = [
      { label: 'Bash: pnpm test', at: 10 },
      { label: 'Edit: src/app.ts', at: 20 }
    ]

    expect(appendAgentToolUse(history, 'Bash: pnpm test', 30)).toHaveLength(3)
  })

  it('keeps only the most recent calls', () => {
    let history = appendAgentToolUse(undefined, 'first', 1)
    for (let index = 2; index <= AGENT_TOOL_TRAIL_MAX + 3; index += 1) {
      history = appendAgentToolUse(history, `call ${index}`, index)
    }

    expect(history).toHaveLength(AGENT_TOOL_TRAIL_MAX)
    expect(history?.[0].label).not.toBe('first')
  })

  it('leaves the trail untouched when there is no tool running', () => {
    const history = [{ label: 'Bash: pnpm test', at: 10 }]

    expect(appendAgentToolUse(history, undefined, 20)).toBe(history)
    expect(appendAgentToolUse(history, '   ', 20)).toBe(history)
  })
})
