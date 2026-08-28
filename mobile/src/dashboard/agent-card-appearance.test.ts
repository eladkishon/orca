import { describe, expect, it } from 'vitest'
import { agentCardPace, agentCardStallReason } from './agent-card-pace'
import { agentCardAppearance, agentCardDisplayState } from './agent-card-appearance'
import { agentActivityKind, agentActivityTarget } from './agent-activity-kind'
import { projectAccentHue } from './project-accent-hue'

const NOW = 1_000_000_000

describe('agentCardPace', () => {
  it('reads silence from a working agent, and nothing from a quiet one', () => {
    expect(agentCardPace({ dotState: 'working', updatedAt: NOW }, NOW)).toBe('advancing')
    expect(agentCardPace({ dotState: 'working', updatedAt: NOW - 60_000 }, NOW)).toBe('slow')
    expect(agentCardPace({ dotState: 'working', updatedAt: NOW - 240_000 }, NOW)).toBe('stalled')
    // A waiting agent is silent on purpose — colouring it stuck would cry wolf.
    expect(agentCardPace({ dotState: 'waiting', updatedAt: NOW - 240_000 }, NOW)).toBe('advancing')
  })
})

describe('agentCardAppearance', () => {
  it('breathes while working and holds still once stalled', () => {
    expect(agentCardAppearance('working', 'advancing').breath).toBe('breathing')
    expect(agentCardAppearance('working', 'slow').breath).toBe('labouring')
    expect(agentCardAppearance('working', 'stalled').breath).toBe('none')
    expect(agentCardAppearance('idle', 'advancing').breath).toBe('none')
  })

  it('gives needs-you, done and idle distinct rings', () => {
    const rings = ['waiting', 'done', 'idle'].map(
      (state) => agentCardAppearance(state as 'idle', 'advancing').ring
    )
    expect(new Set(rings).size).toBe(3)
  })
})

describe('agentCardDisplayState', () => {
  it('keeps a finished agent green until its workspace is seen', () => {
    expect(agentCardDisplayState('done', true)).toBe('done')
    expect(agentCardDisplayState('done', false)).toBe('idle')
    expect(agentCardDisplayState('working', false)).toBe('working')
  })
})

describe('agentActivityKind', () => {
  it('classifies the command a shell tool is really running', () => {
    expect(agentActivityKind('Bash: pnpm vitest run src/app.test.ts')).toBe('testing')
    expect(agentActivityKind('Bash: cd src/build && ls')).toBe('reading')
    expect(agentActivityKind('Bash: npx tsc --noEmit')).toBe('building')
    expect(agentActivityKind('Edit: src/app.ts')).toBe('writing')
    expect(agentActivityKind('Task: review the diff')).toBe('delegating')
    expect(agentActivityKind(undefined)).toBeUndefined()
  })

  it('names what the work is about', () => {
    expect(agentActivityTarget('Edit: /repo/src/app.ts')).toBe('app.ts')
    expect(agentActivityTarget('WebFetch: https://example.test/docs/page')).toBe('example.test')
    expect(agentActivityTarget('Bash: xcodebuild -destination "platform=iOS Simulator,id=1"')).toBe(
      'iOS Simulator'
    )
    expect(agentActivityTarget('Bash')).toBeUndefined()
  })
})

describe('agentCardStallReason', () => {
  it('names the tool it is waiting on', () => {
    expect(agentCardStallReason({ activity: 'Bash: pnpm install' })).toBe('Waiting on Bash')
    expect(agentCardStallReason({})).toBe('No output')
  })
})

describe('projectAccentHue', () => {
  it('is stable per project and spread across the wheel', () => {
    expect(projectAccentHue('repo-a')).toBe(projectAccentHue('repo-a'))
    expect(projectAccentHue('repo-a')).not.toBe(projectAccentHue('repo-b'))
    expect(projectAccentHue('repo-a')).toBeGreaterThanOrEqual(0)
    expect(projectAccentHue('repo-a')).toBeLessThan(360)
  })
})
