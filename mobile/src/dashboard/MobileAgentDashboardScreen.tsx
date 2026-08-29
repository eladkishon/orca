import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Dimensions,
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  View
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { ChevronLeft } from 'lucide-react-native'
import type { RepoIcon } from '../../../src/shared/repo-icon'
import type { RepoBanner } from '../../../src/shared/repo-banner'
import { useNow } from '../hooks/use-now'
import { colors, spacing } from '../theme/mobile-theme'
import {
  DEFAULT_AGENT_BOARD_VIEW,
  loadAgentBoardView,
  saveAgentBoardView,
  type MobileAgentBoardView
} from '../storage/preferences'
import {
  buildDashboardCards,
  groupCardsByProject,
  type DashboardAgentCard,
  type DashboardProjectGroup
} from './agent-dashboard-board'
import {
  dashboardFilterOptions,
  filterDashboardCards,
  EMPTY_DASHBOARD_FILTERS,
  type DashboardFilters
} from './agent-board-filtering'
import { MobileAgentBoardCard } from './MobileAgentBoardCard'
import { MobileAgentBoardToolbar } from './MobileAgentBoardToolbar'
import { MobileAgentBoardFilterSheet } from './MobileAgentBoardFilterSheet'
import { MobileBoardViewToggle } from './MobileBoardViewToggle'
import { MobileProjectBanner } from './MobileProjectBanner'
import { MobileAgentPreviewSheet } from './MobileAgentPreviewSheet'
import {
  repoBannerKey,
  repoIconKey,
  useAgentBoardData,
  useAgentBoardHosts
} from './use-agent-board-data'

/**
 * The desktop agent board, on a phone.
 *
 * Same shape as the pop-out: a project per column, its agents beneath it,
 * needs-you first, with the card's ring carrying state. Rows stacks the
 * projects down the screen; columns keeps them side by side and swipes between
 * them, which is the desktop layout a phone can actually hold.
 *
 * Opened from a host it shows that host; opened from Home it shows every paired
 * host, and each card says which one it is on.
 */
export function MobileAgentDashboardScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { hostId } = useLocalSearchParams<{ hostId?: string }>()
  const now = useNow(5000)

  const hosts = useAgentBoardHosts(hostId)
  const { worktrees, repoIcons, repoBanners, refresh } = useAgentBoardData(hosts)

  const [view, setView] = useState<MobileAgentBoardView>(DEFAULT_AGENT_BOARD_VIEW)
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<DashboardFilters>(EMPTY_DASHBOARD_FILTERS)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [previewCard, setPreviewCard] = useState<DashboardAgentCard | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    let disposed = false
    void loadAgentBoardView().then((saved) => {
      if (!disposed) {
        setView(saved)
      }
    })
    return () => {
      disposed = true
    }
  }, [])

  const updateView = useCallback((next: MobileAgentBoardView) => {
    setView(next)
    void saveAgentBoardView(next)
  }, [])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    void refresh().finally(() => setRefreshing(false))
  }, [refresh])

  const cards = useMemo(() => buildDashboardCards(worktrees, now), [worktrees, now])
  const options = useMemo(() => dashboardFilterOptions(cards), [cards])
  const visibleCards = useMemo(
    () => filterDashboardCards(cards, query, filters),
    [cards, query, filters]
  )
  const projects = useMemo(() => groupCardsByProject(visibleCards), [visibleCards])
  const multiHost = hosts.length > 1
  const connecting = hosts.every((host) => host.state !== 'connected')

  // Tapping a card previews the agent where it stands, as the desktop board
  // does; the workspace is one more tap, from inside the preview.
  const openCard = useCallback((card: DashboardAgentCard) => setPreviewCard(card), [])

  const openSession = useCallback(
    (card: DashboardAgentCard) => {
      setPreviewCard(null)
      router.push(
        `/h/${encodeURIComponent(card.hostId)}/session/${encodeURIComponent(card.worktreeId)}?name=${encodeURIComponent(card.workspaceName)}`
      )
    },
    [router]
  )

  const showWorkspaces = useCallback(() => {
    if (router.canGoBack()) {
      router.back()
      return
    }
    router.replace(hostId ? `/h/${encodeURIComponent(hostId)}` : '/')
  }, [hostId, router])

  const renderCard = useCallback(
    (card: DashboardAgentCard) => (
      <MobileAgentBoardCard
        key={card.paneKey}
        card={card}
        now={now}
        density={view.density}
        showHost={multiHost}
        onPress={openCard}
      />
    ),
    [multiHost, now, openCard, view.density]
  )

  const empty = (
    <Text style={styles.empty}>{connecting ? 'Connecting…' : 'No agents running.'}</Text>
  )

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable
          onPress={showWorkspaces}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ChevronLeft size={20} color={colors.textSecondary} />
        </Pressable>
        <Text style={styles.title}>Agents</Text>
        <Text style={styles.count}>{visibleCards.length}</Text>
        <MobileBoardViewToggle mode="agents" onSelect={showWorkspaces} />
      </View>

      <MobileAgentBoardToolbar
        query={query}
        onQueryChange={setQuery}
        filters={filters}
        onOpenFilters={() => setFiltersOpen(true)}
        orientation={view.orientation}
        onOrientationChange={(orientation) => updateView({ ...view, orientation })}
        density={view.density}
        onDensityChange={(density) => updateView({ ...view, density })}
      />

      {view.orientation === 'columns' ? (
        <BoardColumns
          projects={projects}
          repoIcons={repoIcons}
          repoBanners={repoBanners}
          renderCard={renderCard}
          bottomInset={insets.bottom}
          empty={empty}
        />
      ) : (
        <SectionList
          sections={projects.map((project) => ({ ...project, data: project.cards }))}
          keyExtractor={(card) => card.paneKey}
          contentContainerStyle={{ paddingBottom: insets.bottom + spacing.lg }}
          stickySectionHeadersEnabled={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.textMuted}
            />
          }
          renderSectionHeader={({ section }) => (
            <MobileProjectBanner
              repoId={section.repoId}
              projectName={section.projectName}
              hostName={section.hostName}
              showHost={multiHost}
              repoIcon={repoIcons.get(repoIconKey(section.hostId, section.projectName)) ?? null}
              banner={repoBanners.get(repoBannerKey(section.hostId, section.repoId)) ?? null}
              agentCount={section.data.length}
            />
          )}
          renderItem={({ item }) => <View style={styles.cardWrapper}>{renderCard(item)}</View>}
          ListEmptyComponent={empty}
        />
      )}

      <MobileAgentPreviewSheet
        card={previewCard}
        onClose={() => setPreviewCard(null)}
        onOpenSession={openSession}
      />

      <MobileAgentBoardFilterSheet
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        options={options}
        filters={filters}
        onFiltersChange={setFilters}
      />
    </SafeAreaView>
  )
}

/**
 * Projects side by side, as on desktop — a phone fits one at a time, so the
 * board swipes between them and each column scrolls its own agents.
 */
function BoardColumns({
  projects,
  repoIcons,
  repoBanners,
  renderCard,
  bottomInset,
  empty
}: {
  projects: DashboardProjectGroup[]
  repoIcons: Map<string, RepoIcon>
  repoBanners: Map<string, RepoBanner>
  renderCard: (card: DashboardAgentCard) => React.ReactNode
  bottomInset: number
  empty: React.ReactNode
}) {
  const columnWidth = Math.min(Dimensions.get('window').width - spacing.xl * 2, 420)
  if (projects.length === 0) {
    return <>{empty}</>
  }
  return (
    <ScrollView
      horizontal
      pagingEnabled={false}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.columns}
    >
      {projects.map((project) => (
        <View key={project.projectKey} style={[styles.column, { width: columnWidth }]}>
          <MobileProjectBanner
            repoId={project.repoId}
            projectName={project.projectName}
            hostName={project.hostName}
            showHost={
              project.hostName !== undefined &&
              projects.some((other) => other.hostId !== project.hostId)
            }
            repoIcon={repoIcons.get(repoIconKey(project.hostId, project.projectName)) ?? null}
            banner={repoBanners.get(repoBannerKey(project.hostId, project.repoId)) ?? null}
            agentCount={project.cards.length}
          />
          <ScrollView
            contentContainerStyle={[
              styles.columnCards,
              { paddingBottom: bottomInset + spacing.lg }
            ]}
            showsVerticalScrollIndicator={false}
          >
            {project.cards.map((card) => renderCard(card))}
          </ScrollView>
        </View>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgBase },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  backButton: { padding: spacing.xs },
  title: { flex: 1, fontSize: 17, fontWeight: '600', color: colors.textPrimary },
  count: { fontSize: 12, color: colors.textMuted },
  cardWrapper: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  columns: { paddingHorizontal: spacing.md, gap: spacing.sm },
  column: {
    flex: 1,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    backgroundColor: 'rgba(26,26,26,0.5)',
    overflow: 'hidden'
  },
  columnCards: { padding: spacing.sm, gap: spacing.sm },
  empty: {
    textAlign: 'center',
    marginTop: spacing.xl,
    fontSize: 13,
    color: colors.textMuted
  }
})
