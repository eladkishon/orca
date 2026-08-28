/**
 * What a board card is called.
 *
 * The tab's generated title is derived once, from the FIRST prompt of the
 * session, and never revisited — so a card that has moved on three tasks still
 * announces the one it started with. On a board whose whole job is "what is
 * happening now", that is the wrong sentence.
 *
 * Only that one stale slot is refreshed. A title you typed, a pane's own live
 * title in a split tab, and the setting that turns generated titles off are all
 * more authoritative than a guess made from a prompt, so none of them are
 * touched: if the name in hand did not come from the stale generated slot, it
 * is already the better answer.
 */

import { deriveGeneratedTabTitle } from './agent-tab-title'

/** A leading slash command is Orca's plumbing, not what the task is about. */
const LEADING_SLASH_COMMAND = /^\/[a-z][\w-]*\s+/i

export type DashboardCardHeading = {
  title?: string
  /** True when the title IS the current prompt, so a card showing both would
   *  print the same sentence twice. */
  fromPrompt: boolean
}

export function dashboardCardHeading(args: {
  /** The existing conversation-name chain's answer. */
  conversationName?: string | null
  /** The tab's generated title — the one slot derived from the first prompt. */
  staleGeneratedTitle?: string | null
  /** The agent's most recent prompt. */
  latestPrompt?: string | null
}): DashboardCardHeading {
  const conversationName = args.conversationName?.trim()
  const stale = args.staleGeneratedTitle?.trim()
  if (!conversationName || !stale || conversationName !== stale) {
    return { title: conversationName || undefined, fromPrompt: false }
  }
  const prompt = args.latestPrompt?.replace(LEADING_SLASH_COMMAND, '').trim()
  const derived = prompt ? deriveGeneratedTabTitle(prompt) : null
  return derived === null
    ? { title: conversationName, fromPrompt: false }
    : { title: derived, fromPrompt: true }
}
