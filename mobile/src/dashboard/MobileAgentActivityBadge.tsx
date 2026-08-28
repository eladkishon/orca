import { StyleSheet, Text, View } from 'react-native'
import {
  Braces,
  Compass,
  FlaskConical,
  Globe,
  Hammer,
  ListTodo,
  MessageCircleQuestion,
  type LucideIcon,
  Search,
  Sparkles,
  Terminal,
  Users
} from 'lucide-react-native'
import { colors, spacing, typography } from '../theme/mobile-theme'
import {
  agentActivityKind,
  agentActivityTarget,
  type AgentActivityKind
} from './agent-activity-kind'

// What KIND of work the agent is doing, said in words at the top of its card —
// the desktop board's AgentActivityBadge. The chip below the prose says the
// literal command; this says what that command IS, and what it is about.

type KindPresentation = { icon: LucideIcon; label: string; color: string; background: string }

const PRESENTATION: Readonly<Record<AgentActivityKind, KindPresentation>> = {
  writing: {
    icon: Braces,
    label: 'Writing code',
    color: '#c4b5fd',
    background: 'rgba(139,92,246,0.14)'
  },
  testing: {
    icon: FlaskConical,
    label: 'Testing',
    color: '#6ee7b7',
    background: 'rgba(16,185,129,0.14)'
  },
  building: {
    icon: Hammer,
    label: 'Building',
    color: '#fdba74',
    background: 'rgba(249,115,22,0.14)'
  },
  versioning: {
    icon: Compass,
    label: 'Git',
    color: '#cbd5e1',
    background: 'rgba(100,116,139,0.18)'
  },
  reading: {
    icon: Search,
    label: 'Reading code',
    color: '#7dd3fc',
    background: 'rgba(14,165,233,0.14)'
  },
  searching: {
    icon: Search,
    label: 'Searching',
    color: '#7dd3fc',
    background: 'rgba(14,165,233,0.14)'
  },
  browsing: {
    icon: Globe,
    label: 'Fetching online',
    color: '#67e8f9',
    background: 'rgba(6,182,212,0.14)'
  },
  running: {
    icon: Terminal,
    label: 'Running a command',
    color: colors.textSecondary,
    background: 'rgba(140,140,140,0.14)'
  },
  planning: {
    icon: ListTodo,
    label: 'Planning',
    color: colors.textSecondary,
    background: 'rgba(140,140,140,0.14)'
  },
  delegating: {
    icon: Users,
    label: 'Delegating',
    color: '#a5b4fc',
    background: 'rgba(99,102,241,0.14)'
  },
  asking: {
    icon: MessageCircleQuestion,
    label: 'Asking you',
    color: '#fdba74',
    background: 'rgba(249,115,22,0.18)'
  },
  thinking: {
    icon: Sparkles,
    label: 'Thinking',
    color: colors.textSecondary,
    background: 'rgba(140,140,140,0.14)'
  }
}

export function MobileAgentActivityBadge({ activity }: { activity: string | undefined }) {
  const kind = agentActivityKind(activity)
  if (!kind) {
    return null
  }
  const { icon: Icon, label, color, background } = PRESENTATION[kind]
  const target = agentActivityTarget(activity)
  return (
    <View style={[styles.badge, { backgroundColor: background }]}>
      <Icon size={10} color={color} />
      <Text style={[styles.label, { color }]} numberOfLines={1}>
        {label}
      </Text>
      {target ? (
        <>
          <Text style={[styles.separator, { color }]}>·</Text>
          <Text style={[styles.target, { color }]} numberOfLines={1}>
            {target}
          </Text>
        </>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3
  },
  label: { fontSize: 10, fontWeight: '600', letterSpacing: 0.1 },
  separator: { fontSize: 10, opacity: 0.4 },
  target: { flexShrink: 1, fontSize: 10, fontFamily: typography.monoFamily, opacity: 0.9 }
})
