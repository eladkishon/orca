import { StyleSheet, Text, View } from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import type { RepoIcon } from '../../../src/shared/repo-icon'
import { MobileRepoIcon } from '../components/MobileRepoIcon'
import { colors, spacing } from '../theme/mobile-theme'
import { projectAccentColor, projectAccentHue } from './project-accent-hue'

/**
 * A project heading over a wash of the project's own hue — the desktop board's
 * `.project-banner`. It fades to nothing down the header rather than filling a
 * block, so it reads as light falling on the column instead of a coloured bar
 * competing with every card below it.
 */
export function MobileProjectBanner({
  repoId,
  projectName,
  hostName,
  showHost = false,
  repoIcon,
  agentCount
}: {
  repoId: string
  projectName: string
  hostName?: string
  /** Only a board spanning hosts needs to say which host a project is on. */
  showHost?: boolean
  repoIcon: RepoIcon | null
  agentCount: number
}) {
  const hue = projectAccentHue(repoId)
  const accent = projectAccentColor(repoId)
  return (
    <View style={styles.header}>
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <LinearGradient id={`banner-${repoId}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={`hsl(${hue}, 60%, 66%)`} stopOpacity={0.16} />
            <Stop offset="1" stopColor={`hsl(${hue}, 60%, 66%)`} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#banner-${repoId})`} />
      </Svg>
      <MobileRepoIcon repoIcon={repoIcon} size={16} color={accent} />
      <Text style={[styles.title, { color: accent }]} numberOfLines={1}>
        {projectName}
      </Text>
      {showHost && hostName ? (
        <Text style={styles.host} numberOfLines={1}>
          {hostName}
        </Text>
      ) : null}
      <Text style={styles.count}>{agentCount}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    overflow: 'hidden',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.35
  },
  host: { flexShrink: 1, fontSize: 11, color: colors.textMuted },
  count: { fontSize: 11, color: colors.textMuted }
})
