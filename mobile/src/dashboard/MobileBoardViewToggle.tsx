import { Pressable, StyleSheet, View } from 'react-native'
import { LayoutDashboard, List } from 'lucide-react-native'
import { colors, radii } from '../theme/mobile-theme'

export type MobileBoardViewMode = 'workspaces' | 'agents'

// One tap between the workspace list and the agent board, in the same place on
// both screens — the pair is a view of the same host, not two destinations.
export function MobileBoardViewToggle({
  mode,
  onSelect,
  disabled = false
}: {
  mode: MobileBoardViewMode
  onSelect: (mode: MobileBoardViewMode) => void
  disabled?: boolean
}) {
  return (
    <View style={styles.group}>
      <Segment
        active={mode === 'workspaces'}
        disabled={disabled}
        label="Workspaces"
        onPress={() => onSelect('workspaces')}
        Icon={List}
      />
      <Segment
        active={mode === 'agents'}
        disabled={disabled}
        label="Agents"
        onPress={() => onSelect('agents')}
        Icon={LayoutDashboard}
      />
    </View>
  )
}

function Segment({
  active,
  disabled,
  label,
  onPress,
  Icon
}: {
  active: boolean
  disabled: boolean
  label: string
  onPress: () => void
  Icon: typeof List
}) {
  const color = disabled ? colors.textMuted : active ? colors.textPrimary : colors.textSecondary
  return (
    <Pressable
      style={[styles.segment, active && styles.segmentActive]}
      onPress={onPress}
      disabled={disabled || active}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled }}
      accessibilityLabel={label}
    >
      <Icon size={16} color={color} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  group: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    padding: 2,
    borderRadius: radii.button,
    backgroundColor: colors.bgPanel
  },
  segment: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.button - 1
  },
  segmentActive: { backgroundColor: colors.bgRaised }
})
