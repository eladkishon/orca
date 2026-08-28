export type ClaudeUsageScope = 'orca' | 'all'
export type ClaudeUsageRange = '7d' | '30d' | '90d' | 'all'
export type ClaudeUsageBreakdownKind = 'model' | 'project'

export type ClaudeUsageScanState = {
  enabled: boolean
  isScanning: boolean
  lastScanStartedAt: number | null
  lastScanCompletedAt: number | null
  lastScanError: string | null
  hasAnyClaudeData: boolean
}

export type ClaudeUsageSummary = {
  scope: ClaudeUsageScope
  range: ClaudeUsageRange
  sessions: number
  turns: number
  zeroCacheReadTurns: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  cacheReuseRate: number | null
  estimatedCostUsd: number | null
  topModel: string | null
  topProject: string | null
  hasAnyClaudeData: boolean
}

export type ClaudeUsageDailyPoint = {
  day: string
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
}

export type ClaudeUsageBreakdownRow = {
  key: string
  label: string
  sessions: number
  turns: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  estimatedCostUsd: number | null
}

export type ClaudeUsageSessionRow = {
  sessionId: string
  lastActiveAt: string
  durationMinutes: number
  projectLabel: string
  branch: string | null
  model: string | null
  turns: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
}

/** One project's billable tokens on one day, for the board's trend line. */
export type ClaudeUsageProjectDailyPoint = {
  day: string
  /** Input + output + cache writes. Cache reads are re-used context, so they
   *  would drown a trend that is meant to show what the work cost. */
  billableTokens: number
}

export type ClaudeUsageProjectDaily = {
  key: string
  points: ClaudeUsageProjectDailyPoint[]
}

export type ClaudeUsageSnapshot = {
  scanState: ClaudeUsageScanState
  summary: ClaudeUsageSummary
  daily: ClaudeUsageDailyPoint[]
  modelBreakdown: ClaudeUsageBreakdownRow[]
  projectBreakdown: ClaudeUsageBreakdownRow[]
  projectDaily: ClaudeUsageProjectDaily[]
  recentSessions: ClaudeUsageSessionRow[]
}
