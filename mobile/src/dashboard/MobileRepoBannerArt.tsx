import { StyleSheet } from 'react-native'
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Pattern,
  RadialGradient,
  Rect,
  Stop
} from 'react-native-svg'
import type { RepoBannerVariant } from '../../../src/shared/repo-banner'

/**
 * The generated project banners, as the desktop board draws them in CSS
 * (`.repo-banner[data-banner=…]`): the project's own hue every time, and only
 * the shape of the light changes per variant.
 */
export function MobileRepoBannerArt({ variant, hue }: { variant: RepoBannerVariant; hue: number }) {
  const tint = `hsl(${hue}, 62%, 68%)`
  const far = `hsl(${hue + 45}, 62%, 68%)`
  const id = `${variant}-${Math.round(hue)}`
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        {variant === 'aurora' ? (
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0.5">
            <Stop offset="0" stopColor={tint} stopOpacity={0.24} />
            <Stop offset="0.55" stopColor={far} stopOpacity={0.14} />
            <Stop offset="0.9" stopColor={far} stopOpacity={0} />
          </LinearGradient>
        ) : null}
        {variant === 'mesh' ? (
          <>
            <RadialGradient id={`${id}-a`} cx="12%" cy="0%" rx="60%" ry="120%">
              <Stop offset="0" stopColor={tint} stopOpacity={0.26} />
              <Stop offset="1" stopColor={tint} stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id={`${id}-b`} cx="78%" cy="100%" rx="50%" ry="140%">
              <Stop offset="0" stopColor={far} stopOpacity={0.19} />
              <Stop offset="1" stopColor={far} stopOpacity={0} />
            </RadialGradient>
          </>
        ) : null}
        {variant === 'tide' ? (
          <>
            <RadialGradient id={`${id}-a`} cx="50%" cy="130%" rx="120%" ry="60%">
              <Stop offset="0" stopColor={tint} stopOpacity={0.28} />
              <Stop offset="1" stopColor={tint} stopOpacity={0} />
            </RadialGradient>
            <LinearGradient id={`${id}-b`} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={far} stopOpacity={0.12} />
              <Stop offset="0.7" stopColor={far} stopOpacity={0} />
            </LinearGradient>
          </>
        ) : null}
        {variant === 'rays' ? (
          <Pattern
            id={id}
            width={18}
            height={18}
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(25)"
          >
            <Rect x="0" y="0" width={6} height={18} fill={tint} fillOpacity={0.2} />
          </Pattern>
        ) : null}
        {variant === 'grain' ? (
          <Pattern id={id} width={7} height={7} patternUnits="userSpaceOnUse">
            <Circle cx={1} cy={1} r={1} fill={tint} fillOpacity={0.3} />
          </Pattern>
        ) : null}
      </Defs>
      {variant === 'mesh' || variant === 'tide' ? (
        <>
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id}-a)`} />
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id}-b)`} />
        </>
      ) : (
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      )}
    </Svg>
  )
}
