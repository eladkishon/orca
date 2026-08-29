import { Image, StyleSheet, Text, View } from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import type { RepoIcon } from '../../../src/shared/repo-icon'
import { defaultRepoBannerVariant, type RepoBanner } from '../../../src/shared/repo-banner'
import { MobileRepoIcon } from '../components/MobileRepoIcon'
import { colors, spacing } from '../theme/mobile-theme'
import { projectAccentColor, projectAccentHue } from './project-accent-hue'
import { MobileRepoBannerArt } from './MobileRepoBannerArt'

/**
 * A project heading over its own banner — the desktop board's
 * `.project-banner`. Same two kinds: the picture the repo was given, behind a
 * scrim so the heading stays readable, else the generated banner drawn from the
 * project's hue, so no two columns look alike before anyone chooses anything.
 */
export function MobileProjectBanner({
  repoId,
  projectName,
  hostName,
  showHost = false,
  repoIcon,
  banner,
  agentCount
}: {
  repoId: string
  projectName: string
  hostName?: string
  /** Only a board spanning hosts needs to say which host a project is on. */
  showHost?: boolean
  repoIcon: RepoIcon | null
  banner?: RepoBanner | null
  agentCount: number
}) {
  const hue = projectAccentHue(repoId)
  const accent = projectAccentColor(repoId)
  const image = banner?.kind === 'image' ? banner : null
  const variant = banner?.kind === 'generated' ? banner.variant : defaultRepoBannerVariant(repoId)
  return (
    <View style={styles.header}>
      {image ? (
        <>
          <Image
            source={{ uri: image.src }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            accessibilityElementsHidden
          />
          {/* A photograph behind text is the fastest way to make a heading
              unreadable, so the scrim is structure, not decoration. */}
          <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
            <Defs>
              <LinearGradient id={`scrim-${repoId}`} x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={colors.bgBase} stopOpacity={0.92} />
                <Stop offset="0.5" stopColor={colors.bgBase} stopOpacity={0.75} />
                <Stop offset="1" stopColor={colors.bgBase} stopOpacity={0.4} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill={`url(#scrim-${repoId})`} />
          </Svg>
        </>
      ) : (
        <MobileRepoBannerArt variant={variant} hue={hue} />
      )}
      <MobileRepoIcon repoIcon={repoIcon} size={16} color={accent} />
      <Text
        style={[styles.title, { color: image ? colors.textPrimary : accent }]}
        numberOfLines={1}
      >
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
