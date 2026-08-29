import { describe, expect, it } from 'vitest'
import { AGENT_TOUCHPOINTS_MAX, agentTouchpoints } from './agent-touchpoints'

describe('agentTouchpoints', () => {
  it('lifts the page a browser tool loaded, newest first', () => {
    expect(
      agentTouchpoints([
        'Bash: pnpm dev',
        'mcp__chrome-devtools__navigate_page: http://localhost:3000/users/1',
        'WebFetch: https://vitest.dev/guide/'
      ])
    ).toEqual([
      {
        kind: 'browser',
        label: 'vitest.dev/guide',
        url: 'https://vitest.dev/guide/'
      },
      {
        kind: 'browser',
        label: 'localhost:3000/users',
        url: 'http://localhost:3000/users/1'
      }
    ])
  })

  it('names the simulator once, whichever command reached it', () => {
    expect(
      agentTouchpoints(['Bash: xcrun simctl boot ABC-123', 'Bash: xcrun simctl launch booted app'])
    ).toEqual([{ kind: 'simulator', label: 'Simulator' }])
  })

  it('ignores trailing punctuation and unparseable addresses', () => {
    expect(agentTouchpoints(['Bash: curl http://localhost:5173/api.', 'Edit: http://'])).toEqual([
      {
        kind: 'browser',
        label: 'localhost:5173/api',
        url: 'http://localhost:5173/api'
      }
    ])
  })

  it('caps what a card carries', () => {
    const labels = Array.from({ length: 12 }, (_, index) => `Bash: curl http://host${index}/`)
    expect(agentTouchpoints(labels)).toHaveLength(AGENT_TOUCHPOINTS_MAX)
  })

  it('has nothing to say about ordinary edits', () => {
    expect(agentTouchpoints(['Edit: src/app.ts', undefined, 'Bash: pnpm test'])).toEqual([])
  })
})
