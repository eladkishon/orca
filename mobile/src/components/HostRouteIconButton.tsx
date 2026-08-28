import type { ComponentType } from 'react'
import { Pressable, type StyleProp, type ViewStyle } from 'react-native'
import { colors } from '../theme/mobile-theme'

type Props = {
  Icon: ComponentType<{ size: number; color: string }>
  label: string
  onPress: () => void
  style: StyleProp<ViewStyle>
  connected: boolean
  size?: number
}

// One host-toolbar navigation button (Accounts / Tasks / Agents): dimmed and
// inert while the host is not connected.
export function HostRouteIconButton({ Icon, label, onPress, style, connected, size = 16 }: Props) {
  return (
    <Pressable
      style={style}
      onPress={onPress}
      disabled={!connected}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Icon size={size} color={connected ? colors.textSecondary : colors.textMuted} />
    </Pressable>
  )
}
