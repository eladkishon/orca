import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Check } from 'lucide-react-native'
import { BottomDrawer } from '../components/BottomDrawer'
import { colors, radii, spacing } from '../theme/mobile-theme'
import {
  EMPTY_DASHBOARD_FILTERS,
  toggleDashboardFilter,
  type DashboardFilters,
  type DashboardReviewFilter
} from './agent-board-filtering'

const REVIEW_LABELS: Record<DashboardReviewFilter, string> = {
  open: 'Review: open',
  draft: 'Review: draft',
  merged: 'Review: merged',
  closed: 'Review: closed',
  none: 'No review'
}

/** The board's project / workspace-status / review filters, as the desktop toolbar offers them. */
export function MobileAgentBoardFilterSheet({
  visible,
  onClose,
  options,
  filters,
  onFiltersChange
}: {
  visible: boolean
  onClose: () => void
  options: {
    projects: { id: string; label: string }[]
    workspaceStatuses: string[]
    reviewStates: DashboardReviewFilter[]
  }
  filters: DashboardFilters
  onFiltersChange: (filters: DashboardFilters) => void
}) {
  return (
    <BottomDrawer visible={visible} onClose={onClose}>
      <Text style={styles.sheetTitle}>Filter agents</Text>
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        <Section title="Projects">
          {options.projects.map((project) => (
            <FilterRow
              key={project.id}
              label={project.label}
              selected={filters.projects.includes(project.id)}
              onPress={() =>
                onFiltersChange({
                  ...filters,
                  projects: toggleDashboardFilter(filters.projects, project.id)
                })
              }
            />
          ))}
        </Section>

        {options.workspaceStatuses.length > 0 ? (
          <Section title="Workspace status">
            {options.workspaceStatuses.map((status) => (
              <FilterRow
                key={status}
                label={status}
                selected={filters.workspaceStatuses.includes(status)}
                onPress={() =>
                  onFiltersChange({
                    ...filters,
                    workspaceStatuses: toggleDashboardFilter(filters.workspaceStatuses, status)
                  })
                }
              />
            ))}
          </Section>
        ) : null}

        <Section title="Review">
          {options.reviewStates.map((state) => (
            <FilterRow
              key={state}
              label={REVIEW_LABELS[state]}
              selected={filters.reviewStates.includes(state)}
              onPress={() =>
                onFiltersChange({
                  ...filters,
                  reviewStates: toggleDashboardFilter(filters.reviewStates, state)
                })
              }
            />
          ))}
        </Section>

        <Pressable
          style={styles.clear}
          onPress={() => onFiltersChange(EMPTY_DASHBOARD_FILTERS)}
          accessibilityRole="button"
          accessibilityLabel="Clear filters"
        >
          <Text style={styles.clearLabel}>Clear all</Text>
        </Pressable>
      </ScrollView>
    </BottomDrawer>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  )
}

function FilterRow({
  label,
  selected,
  onPress
}: {
  label: string
  selected: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      style={styles.row}
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
    >
      <View style={[styles.checkbox, selected && styles.checkboxChecked]}>
        {selected ? <Check size={11} color={colors.bgBase} /> : null}
      </View>
      <Text style={styles.rowLabel} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  sheetTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    paddingBottom: spacing.xs
  },
  body: { maxHeight: 420 },
  bodyContent: { paddingBottom: spacing.lg },
  section: { paddingTop: spacing.md },
  sectionTitle: {
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textMuted,
    paddingBottom: spacing.xs
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center'
  },
  checkboxChecked: { backgroundColor: colors.textPrimary, borderColor: colors.textPrimary },
  rowLabel: { flex: 1, fontSize: 13, color: colors.textPrimary },
  clear: {
    marginTop: spacing.lg,
    alignSelf: 'flex-start',
    borderRadius: radii.button,
    backgroundColor: colors.bgPanel,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  clearLabel: { fontSize: 12, color: colors.textSecondary }
})
