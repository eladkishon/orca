/**
 * How much of each agent a board card shows.
 *
 * Compact is the scanning view: one card per agent, enough to tell them apart.
 * Detailed turns each card into a small window onto its agent — the same
 * fields, given the room to actually be read, plus the ones compact has to
 * drop. Nothing new is fetched for either; the snapshot already carries it all.
 *
 * Live drops the summary entirely: every agent becomes its own terminal you can
 * type into, laid out in the same project columns. It is the only level that
 * costs anything — one live pty stream per agent on screen.
 */

export type DashboardCardDensity = 'compact' | 'detailed' | 'live'

export type DashboardCardDensityStyle = {
  /** Lines of the agent's own message. The single biggest legibility lever. */
  agentMessageClamp: string
  /** Characters kept of the agent's message before it is elided. The clamp
   *  alone cannot do this: a flattened dump would fill every allowed line. */
  agentMessageChars: number
  /** Characters kept of the prompt. */
  userMessageChars: number
  /** Lines of the prompt that started the turn. */
  userMessageClamp: string
  card: string
  heading: string
  /** The title is the card's whole point, so it wraps rather than truncating —
   *  a cut title is the one line on the card that cannot afford to be unread. */
  headingClamp: string
  message: string
  /** Detailed lets a long command wrap instead of cutting it at the card edge. */
  activity: string
  /** Detailed opens the subagent list, since hunting for a disclosure defeats
   *  the point of asking for more detail. */
  subagentsOpen: boolean
}

const COMPACT: DashboardCardDensityStyle = {
  agentMessageClamp: 'line-clamp-2',
  agentMessageChars: 150,
  userMessageClamp: 'line-clamp-1',
  userMessageChars: 110,
  card: 'gap-2 p-3',
  heading: 'text-[15px] leading-[1.25] tracking-[-0.011em]',
  headingClamp: 'line-clamp-2',
  message: 'text-[12px] leading-[1.5]',
  activity: 'h-5 items-center',
  subagentsOpen: false
}

const DETAILED: DashboardCardDensityStyle = {
  agentMessageClamp: 'line-clamp-[6]',
  agentMessageChars: 420,
  userMessageClamp: 'line-clamp-3',
  userMessageChars: 260,
  card: 'gap-2.5 p-4',
  // Why: tracking is size-specific — the heading tightens further as it grows.
  heading: 'text-[16px] leading-[1.3] tracking-[-0.014em]',
  headingClamp: 'line-clamp-3',
  message: 'text-[12.5px] leading-[1.6]',
  activity: 'min-h-5 items-start',
  subagentsOpen: true
}

export function dashboardCardDensityStyle(
  density: DashboardCardDensity
): DashboardCardDensityStyle {
  return density === 'compact' ? COMPACT : DETAILED
}

const DENSITY_CYCLE: DashboardCardDensity[] = ['compact', 'detailed', 'live']

/** The expand control's next stop: compact → detailed → live → compact. */
export function nextDashboardCardDensity(density: DashboardCardDensity): DashboardCardDensity {
  const index = DENSITY_CYCLE.indexOf(density)
  return DENSITY_CYCLE[(index + 1) % DENSITY_CYCLE.length] ?? 'compact'
}
