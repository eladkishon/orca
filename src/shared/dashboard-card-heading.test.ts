import { describe, expect, it } from 'vitest'
import { dashboardCardHeading } from './dashboard-card-heading'

const STALE = 'Implement the business UI pass'

describe('dashboardCardHeading', () => {
  it('names the task the agent is on now, not the one it started with', () => {
    expect(
      dashboardCardHeading({
        conversationName: STALE,
        staleGeneratedTitle: STALE,
        latestPrompt: 'add a filter for test sessions'
      })
    ).toEqual({ title: 'Add a filter for test sessions', fromPrompt: true })
  })

  it('drops a leading slash command, which is plumbing not subject', () => {
    expect(
      dashboardCardHeading({
        conversationName: STALE,
        staleGeneratedTitle: STALE,
        latestPrompt: '/goal make the PR ready to merge'
      })
    ).toEqual({ title: 'Make the PR ready to merge', fromPrompt: true })
  })

  it('leaves any name that did not come from the stale slot alone', () => {
    // A title the user typed, a split pane's own live title, or a name produced
    // while generated titles are switched off — each already beats a guess.
    expect(
      dashboardCardHeading({
        conversationName: 'Linear work log',
        staleGeneratedTitle: STALE,
        latestPrompt: 'add a filter for test sessions'
      })
    ).toEqual({ title: 'Linear work log', fromPrompt: false })
  })

  it('invents no name where the chain found none', () => {
    expect(
      dashboardCardHeading({ conversationName: null, latestPrompt: 'add a filter' }).title
    ).toBeUndefined()
  })

  it('keeps the stale name when the latest prompt yields nothing usable', () => {
    expect(
      dashboardCardHeading({
        conversationName: STALE,
        staleGeneratedTitle: STALE,
        latestPrompt: '   '
      })
    ).toEqual({ title: STALE, fromPrompt: false })
  })
})
