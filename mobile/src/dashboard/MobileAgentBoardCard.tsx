import { memo, useEffect, useRef } from 'react'
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native'
import { GitBranch } from 'lucide-react-native'
import { colors, radii, spacing, typography } from '../theme/mobile-theme'
import { agentStateLabel, formatTimeAgo } from '../worktree/agent-row-display'
import { MobileAgentIcon } from '../components/MobileAgentIcon'
import { agentIdentityLabel } from '../worktree/agent-row-display'
import type { DashboardAgentCard } from './agent-dashboard-board'
import { agentCardAppearance } from './agent-card-appearance'
import { agentCardPace, agentCardStallReason } from './agent-card-pace'
import { MobileAgentActivityBadge } from './MobileAgentActivityBadge'
import { dashboardCardDensityStyle, type DashboardCardDensity } from './dashboard-card-density'

const BREATH_MS = 4500
const LABOURED_BREATH_MS = 9000

/** The card's ring and bloom, breathing while the agent is not settled. */
function CardRing({
  ring,
  glow,
  breath,
  dim
}: {
  ring: string
  glow: string
  breath: 'none' | 'breathing' | 'labouring'
  dim: number
}) {
  const opacity = useRef(new Animated.Value(1)).current

  useEffect(() => {
    if (breath === 'none') {
      opacity.setValue(1)
      return undefined
    }
    // Slow, and eased at both ends: a breath rests at the top and the bottom.
    const duration = breath === 'labouring' ? LABOURED_BREATH_MS : BREATH_MS
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: dim,
          duration,
          easing: Easing.bezier(0.4, 0, 0.6, 1),
          useNativeDriver: true
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration,
          easing: Easing.bezier(0.4, 0, 0.6, 1),
          useNativeDriver: true
        })
      ])
    )
    animation.start()
    return () => animation.stop()
  }, [breath, dim, opacity])

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        styles.ring,
        {
          borderColor: ring,
          opacity,
          shadowColor: glow
        }
      ]}
    />
  )
}

type Props = {
  card: DashboardAgentCard
  now: number
  onPress: (card: DashboardAgentCard) => void
  /** How much of the agent to show — the desktop board's compact/detailed. */
  density?: DashboardCardDensity
  /** A board spanning hosts names the host each agent runs on. */
  showHost?: boolean
}

function reviewTone(state: string): string {
  const normalized = state.toLowerCase()
  if (normalized === 'merged') {
    return colors.statusPurple
  }
  if (normalized === 'closed') {
    return colors.statusRed
  }
  return colors.statusGreen
}

/** One agent on the board — the mobile shape of the desktop AgentKanbanCard. */
function MobileAgentBoardCardComponent({
  card,
  now,
  onPress,
  density = 'compact',
  showHost = false
}: Props) {
  const style = dashboardCardDensityStyle(density)
  const pace = agentCardPace(card, now)
  const { ring, glow, surface, breath, dim } = agentCardAppearance(card.dotState, pace)

  return (
    <Pressable
      onPress={() => onPress(card)}
      accessibilityRole="button"
      accessibilityLabel={`${card.heading}: ${agentStateLabel(card.dotState)}`}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: surface, padding: style.padding, gap: style.gap },
        pace !== 'advancing' && styles.cardWithStallReason,
        pressed && styles.cardPressed
      ]}
    >
      <CardRing ring={ring} glow={glow} breath={breath} dim={dim} />

      {/* A stopped ring says "not advancing" but cannot say why. The reason
          rides on the frame it belongs to, not on a line of card content. */}
      {pace === 'advancing' ? null : (
        <Text style={styles.stallReason} numberOfLines={1}>
          {agentCardStallReason(card)}
        </Text>
      )}

      <View style={styles.cornerBadges}>
        {card.linearIssue ? (
          <Text style={[styles.cornerBadge, styles.linearBadge]} numberOfLines={1}>
            {card.linearIssue}
          </Text>
        ) : null}
        {card.review ? (
          <Text
            style={[
              styles.cornerBadge,
              { color: reviewTone(card.review.state), borderColor: reviewTone(card.review.state) }
            ]}
            numberOfLines={1}
          >
            #{card.review.number}
          </Text>
        ) : null}
      </View>

      <MobileAgentActivityBadge activity={card.activity} />

      <Text
        style={[
          styles.heading,
          { fontSize: style.headingSize },
          !card.unseen && styles.headingSeen
        ]}
        numberOfLines={style.headingLines}
      >
        {card.heading}
      </Text>

      {card.userMessage ? (
        <Text style={styles.message} numberOfLines={style.userMessageLines}>
          <Text style={styles.speaker}>You </Text>
          {card.userMessage}
        </Text>
      ) : null}

      {card.agentMessage ? (
        <Text
          style={[styles.agentMessage, { fontSize: style.agentMessageSize }]}
          numberOfLines={style.agentMessageLines}
        >
          <Text style={styles.speaker}>{agentIdentityLabel(card.agentType) || 'Agent'} </Text>
          {card.agentMessage}
        </Text>
      ) : null}

      {card.activity ? (
        <View style={styles.commandChip}>
          <Text style={styles.commandText} numberOfLines={density === 'detailed' ? 3 : 1}>
            {card.activity}
          </Text>
        </View>
      ) : null}

      <View style={styles.footer}>
        {card.agentType ? <MobileAgentIcon agentId={card.agentType} size={12} /> : null}
        <View style={[styles.checkoutChip, card.isMainWorktree && styles.checkoutChipMain]}>
          {card.isMainWorktree ? null : <GitBranch size={9} color={colors.textMuted} />}
          <Text
            style={[styles.checkoutLabel, card.isMainWorktree && styles.checkoutLabelMain]}
            numberOfLines={1}
          >
            {card.isMainWorktree ? 'main' : 'worktree'}
          </Text>
        </View>
        <Text style={styles.footerWorkspace} numberOfLines={1}>
          {showHost && card.hostName ? `${card.hostName} · ` : ''}
          {card.workspaceName}
        </Text>
        {card.stateStartedAt > 0 ? (
          <Text style={styles.footerTime}>{formatTimeAgo(card.stateStartedAt, now)}</Text>
        ) : null}
      </View>
    </Pressable>
  )
}

export const MobileAgentBoardCard = memo(MobileAgentBoardCardComponent)

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: radii.card,
    padding: spacing.md,
    gap: 6,
    // The bloom: wide and soft, so it reads as light rather than a second border.
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 10
  },
  cardWithStallReason: { paddingTop: spacing.lg },
  cardPressed: { opacity: 0.85 },
  ring: {
    borderWidth: 1,
    borderRadius: radii.card,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 12
  },
  stallReason: {
    position: 'absolute',
    top: 0,
    alignSelf: 'center',
    maxWidth: '70%',
    borderBottomLeftRadius: radii.button,
    borderBottomRightRadius: radii.button,
    backgroundColor: 'rgba(245,158,11,0.18)',
    color: '#fcd34d',
    fontSize: 9.5,
    fontWeight: '500',
    letterSpacing: 0.2,
    paddingHorizontal: 6,
    paddingVertical: 1
  },
  cornerBadges: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  cornerBadge: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.button,
    paddingHorizontal: 4,
    paddingVertical: 1,
    fontSize: 9.5,
    fontWeight: '600'
  },
  linearBadge: { color: colors.textMuted, borderColor: colors.borderSubtle },
  heading: {
    // The heading is what you scan a column by, so it leads the card outright.
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
    color: colors.textPrimary,
    paddingRight: 56
  },
  headingSeen: { color: colors.textSecondary },
  speaker: { fontWeight: '600', color: colors.textMuted },
  message: { fontSize: 11, lineHeight: 16, color: colors.textMuted },
  agentMessage: { fontSize: 12.5, lineHeight: 18, color: colors.textPrimary },
  commandChip: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    borderRadius: radii.button,
    backgroundColor: 'rgba(140,140,140,0.14)',
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  commandText: { fontFamily: typography.monoFamily, fontSize: 10.5, color: colors.textSecondary },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSubtle
  },
  checkoutChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderRadius: radii.button,
    backgroundColor: 'rgba(140,140,140,0.12)',
    paddingHorizontal: 4,
    paddingVertical: 1
  },
  checkoutChipMain: { backgroundColor: 'rgba(245,158,11,0.12)' },
  checkoutLabel: { fontSize: 9.5, fontWeight: '500', color: colors.textMuted },
  checkoutLabelMain: { color: '#fcd34d' },
  footerWorkspace: { flex: 1, fontSize: 10, color: colors.textMuted },
  footerTime: { fontSize: 10, color: colors.textMuted }
})
