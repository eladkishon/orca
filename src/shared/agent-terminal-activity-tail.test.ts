import { describe, expect, it } from 'vitest'
import { agentTerminalActivityTail } from './agent-terminal-activity-tail'

const ESC = '\u001b'

describe('agentTerminalActivityTail', () => {
  it('keeps the words and drops the frame around them', () => {
    const framed = [
      '\u256d\u2500\u2500\u2500\u256e',
      '\u2502 Editing src/app.ts \u2502',
      '\u2570\u2500\u2500\u2500\u256f'
    ].join('\n')

    expect(agentTerminalActivityTail(framed)).toEqual(['Editing src/app.ts'])
  })

  it('strips the colours the agent painted the line with', () => {
    expect(agentTerminalActivityTail(`${ESC}[32mRunning tests${ESC}[0m`)).toEqual(['Running tests'])
  })

  it('reads only what a redrawn progress line actually left on screen', () => {
    // A bare CR redraws in place, so the earlier percentage was never visible
    // at the same time as the later one.
    expect(agentTerminalActivityTail('Building 10%\rBuilding 90%')).toEqual(['Building 90%'])
  })

  it('drops spinner frames rather than showing braille noise', () => {
    expect(agentTerminalActivityTail('\u2839 Thinking')).toEqual(['Thinking'])
    expect(agentTerminalActivityTail('\u2839\u2838\u283c')).toEqual([])
  })

  it('returns the newest lines last, capped', () => {
    const output = ['first', 'second', 'third', 'fourth'].join('\n')

    expect(agentTerminalActivityTail(output, 2)).toEqual(['third', 'fourth'])
  })

  it('collapses a status the TUI repeated while redrawing', () => {
    const repeated = ['Waiting for tests', 'Waiting for tests', 'Waiting for tests'].join('\n')

    expect(agentTerminalActivityTail(repeated)).toEqual(['Waiting for tests'])
  })

  it('has nothing to say when the screen is all chrome', () => {
    expect(agentTerminalActivityTail('\u2502   \u2502\n\u2570\u2500\u2500\u256f\n   ')).toEqual([])
    expect(agentTerminalActivityTail('')).toEqual([])
  })

  it('skips the key hints and meters the CLI paints on every frame', () => {
    // These are always the newest lines on screen, so without filtering they
    // are all the card would ever show.
    const screen = [
      '\u23fa Bash(pnpm test)',
      'Running tests',
      '? for shortcuts',
      'esc to interrupt',
      'Context left until auto-compact: 23%',
      '>'
    ].join('\n')

    expect(agentTerminalActivityTail(screen, 3)).toEqual([
      '\u23fa Bash(pnpm test)',
      'Running tests'
    ])
  })

  it('keeps prose that merely mentions a key, since that is the agent talking', () => {
    expect(agentTerminalActivityTail('Added an escape hatch to the parser')).toEqual([
      'Added an escape hatch to the parser'
    ])
  })

  it('keeps a tool marker glyph attached to its text', () => {
    expect(agentTerminalActivityTail('\u23fa Read(src/app.ts)')).toEqual([
      '\u23fa Read(src/app.ts)'
    ])
  })
})
