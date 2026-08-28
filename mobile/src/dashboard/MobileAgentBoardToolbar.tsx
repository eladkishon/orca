import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Columns3, Filter, Maximize2, Minimize2, Rows3 } from 'lucide-react-native'
import { MobileSearchField } from '../components/MobileSearchField'
import { colors, radii, spacing } from '../theme/mobile-theme'
import type { DashboardCardDensity } from './dashboard-card-density'
import { activeDashboardFilterCount, type DashboardFilters } from './agent-board-filtering'

export type MobileBoardOrientation = 'columns' | 'rows'

/** Search, filters, layout and density — the desktop board's toolbar, in a row. */
export function MobileAgentBoardToolbar({
  query,
  onQueryChange,
  filters,
  onOpenFilters,
  orientation,
  onOrientationChange,
  density,
  onDensityChange
}: {
  query: string
  onQueryChange: (query: string) => void
  filters: DashboardFilters
  onOpenFilters: () => void
  orientation: MobileBoardOrientation
  onOrientationChange: (orientation: MobileBoardOrientation) => void
  density: DashboardCardDensity
  onDensityChange: (density: DashboardCardDensity) => void
}) {
  const activeFilters = activeDashboardFilterCount(filters)
  return (
    <View style={styles.toolbar}>
      <MobileSearchField value={query} onChangeText={onQueryChange} placeholder="Search agents…" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.buttons}
      >
        <Pressable
          style={[styles.button, activeFilters > 0 && styles.buttonActive]}
          onPress={onOpenFilters}
          accessibilityRole="button"
          accessibilityLabel={`Filter agents${activeFilters > 0 ? `, ${activeFilters} active` : ''}`}
        >
          <Filter size={13} color={activeFilters > 0 ? colors.textPrimary : colors.textSecondary} />
          <Text style={[styles.buttonLabel, activeFilters > 0 && styles.buttonLabelActive]}>
            {activeFilters > 0 ? `Filter ${activeFilters}` : 'Filter'}
          </Text>
        </Pressable>

        <Pressable
          style={styles.button}
          onPress={() => onOrientationChange(orientation === 'rows' ? 'columns' : 'rows')}
          accessibilityRole="button"
          accessibilityLabel="Board layout"
          accessibilityState={{ selected: orientation === 'columns' }}
        >
          {orientation === 'rows' ? (
            <Rows3 size={13} color={colors.textSecondary} />
          ) : (
            <Columns3 size={13} color={colors.textSecondary} />
          )}
          <Text style={styles.buttonLabel}>{orientation === 'rows' ? 'Rows' : 'Columns'}</Text>
        </Pressable>

        <Pressable
          style={styles.button}
          onPress={() => onDensityChange(density === 'detailed' ? 'compact' : 'detailed')}
          accessibilityRole="button"
          accessibilityLabel="Card detail"
          accessibilityState={{ selected: density === 'detailed' }}
        >
          {density === 'detailed' ? (
            <Minimize2 size={13} color={colors.textSecondary} />
          ) : (
            <Maximize2 size={13} color={colors.textSecondary} />
          )}
          <Text style={styles.buttonLabel}>{density === 'detailed' ? 'Detailed' : 'Compact'}</Text>
        </Pressable>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  toolbar: { gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  buttons: { flexDirection: 'row', gap: spacing.xs },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radii.button,
    backgroundColor: colors.bgPanel,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6
  },
  buttonActive: { backgroundColor: colors.bgRaised },
  buttonLabel: { fontSize: 11, color: colors.textSecondary },
  buttonLabelActive: { color: colors.textPrimary }
})
