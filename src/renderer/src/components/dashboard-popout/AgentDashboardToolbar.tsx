import { ChevronDown, Columns3, Filter, Maximize2, Minimize2, Rows3, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { getWorkspaceStatusVisualMeta } from '../sidebar/workspace-status'
import type { DashboardCardDensity } from './dashboard-card-density'
import type { DashboardBoardOrientation } from './dashboard-board-orientation'
import type { DashboardCard, DashboardFilterOptions } from '../../../../shared/dashboard-snapshot'
import {
  activeDashboardFilterCount,
  type DashboardFilters,
  type DashboardReviewFilter,
  toggleDashboardFilter
} from './agent-board-filtering'
import {
  projectOptions,
  REVIEW_OPTIONS,
  reviewCountsByState,
  reviewStateLabel,
  workspaceStatusOptions
} from './agent-dashboard-filter-options'
import { AgentDashboardFilterChips } from './AgentDashboardFilterChips'
import { FilterOptionCount } from './FilterOptionCount'
import { ShortcutKeyCombo } from '@/components/ShortcutKeyCombo'

type AgentDashboardToolbarProps = {
  cards: DashboardCard[]
  filterOptions?: DashboardFilterOptions
  filteredCount: number
  query: string
  onQueryChange: (query: string) => void
  filters: DashboardFilters
  onFiltersChange: (filters: DashboardFilters) => void
  searchInputRef: React.RefObject<HTMLInputElement | null>
  /** Replaces the built-in dropdown. The map needs a popover: its panel holds
   *  range sliders, and a Radix menu swallows the arrow keys those need. */
  filterControl?: React.ReactNode
  /** Omitted by surfaces with no cards to size — the map draws its own nodes. */
  density?: DashboardCardDensity
  onDensityChange?: (density: DashboardCardDensity) => void
  orientation?: DashboardBoardOrientation
  onOrientationChange?: (orientation: DashboardBoardOrientation) => void
}

export function AgentDashboardToolbar({
  cards,
  filterOptions,
  filteredCount,
  query,
  onQueryChange,
  filters,
  onFiltersChange,
  searchInputRef,
  filterControl,
  density,
  onDensityChange,
  orientation,
  onOrientationChange
}: AgentDashboardToolbarProps): React.JSX.Element {
  const isMac = navigator.userAgent.includes('Mac')
  const projects = projectOptions(cards, filterOptions?.projects)
  const statuses = workspaceStatusOptions(cards, filterOptions?.workspaceStatuses)
  const reviewCounts = reviewCountsByState(cards)
  const activeCount = activeDashboardFilterCount(filters)
  const toggleProject = (id: string): void =>
    onFiltersChange({ ...filters, projects: toggleDashboardFilter(filters.projects, id) })
  const toggleStatus = (id: string): void =>
    onFiltersChange({
      ...filters,
      workspaceStatuses: toggleDashboardFilter(filters.workspaceStatuses, id)
    })
  const toggleReview = (id: DashboardReviewFilter): void =>
    onFiltersChange({
      ...filters,
      reviewStates: toggleDashboardFilter(filters.reviewStates, id)
    })
  const clearFilters = (): void => {
    onFiltersChange({ projects: [], workspaceStatuses: [], reviewStates: [] })
  }
  const reviewLabel = (id: DashboardReviewFilter): string =>
    translate('dashboardPopout.filters.reviewChip', 'Review: {{state}}', {
      state: reviewStateLabel(id)
    })

  return (
    <>
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={translate(
              'dashboardPopout.search.placeholder',
              'Search worktree, project, or agent…'
            )}
            aria-label={translate('dashboardPopout.search.label', 'Search agents')}
            className="h-7 bg-muted/55 pr-16 pl-7 text-xs"
          />
          {query ? (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => onQueryChange('')}
              aria-label={translate('dashboardPopout.search.clear', 'Clear search')}
              className="absolute top-1/2 right-0.5 -translate-y-1/2 text-muted-foreground"
            >
              <X className="size-3" />
            </Button>
          ) : (
            <ShortcutKeyCombo
              keys={[isMac ? '⌘' : 'Ctrl', 'K']}
              className="pointer-events-none absolute top-1/2 right-1 -translate-y-1/2"
              keyCapClassName="min-w-4 px-1 py-0 text-[9px] shadow-none"
              separatorClassName="text-[9px] text-muted-foreground"
            />
          )}
        </div>
        {!filterControl && (query || activeCount > 0) ? (
          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
            {translate('dashboardPopout.search.results', '{{shown}} of {{total}} shown', {
              shown: filteredCount,
              total: cards.length
            })}
          </span>
        ) : null}
        {orientation && onOrientationChange ? (
          <Button
            variant="outline"
            size="xs"
            aria-label={translate('dashboardPopout.orientation.label', 'Board layout')}
            aria-pressed={orientation === 'rows'}
            onClick={() => onOrientationChange(orientation === 'rows' ? 'columns' : 'rows')}
            className={cn(
              'h-7 shrink-0 gap-1.5 px-2 text-xs',
              orientation === 'rows' && 'border-foreground/25 bg-muted'
            )}
          >
            {orientation === 'rows' ? (
              <Rows3 className="size-3" />
            ) : (
              <Columns3 className="size-3" />
            )}
            {orientation === 'rows'
              ? translate('dashboardPopout.orientation.rows', 'Rows')
              : translate('dashboardPopout.orientation.columns', 'Columns')}
          </Button>
        ) : null}
        {density && onDensityChange ? (
          <Button
            variant="outline"
            size="xs"
            // Why: a pressed toggle, not a menu item — it is one binary the user
            // flips while reading, so it stays one click away and shows its own
            // state rather than hiding it behind a dropdown.
            // Why: the NAME of a toggle is the control, not its state — a
            // button that renames itself reads as a different control each
            // press. aria-pressed carries the state.
            aria-label={translate('dashboardPopout.density.label', 'Card detail')}
            aria-pressed={density === 'detailed'}
            onClick={() => onDensityChange(density === 'detailed' ? 'compact' : 'detailed')}
            className={cn(
              'h-7 shrink-0 gap-1.5 px-2 text-xs',
              density === 'detailed' && 'border-foreground/25 bg-muted'
            )}
          >
            {density === 'detailed' ? (
              <Minimize2 className="size-3" />
            ) : (
              <Maximize2 className="size-3" />
            )}
            {density === 'detailed'
              ? translate('dashboardPopout.density.detailed', 'Detailed')
              : translate('dashboardPopout.density.compact', 'Compact')}
          </Button>
        ) : null}
        {filterControl ?? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="xs"
                className={cn(
                  'h-7 gap-1.5 px-2 text-xs',
                  activeCount > 0 && 'border-foreground/25'
                )}
              >
                <Filter className="size-3" />
                {translate('dashboardPopout.filters.label', 'Filter')}
                {activeCount > 0 ? (
                  <span className="rounded-full bg-foreground px-1.5 py-px text-[10px] leading-none text-background">
                    {activeCount}
                  </span>
                ) : null}
                <ChevronDown className="size-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64" sideOffset={6}>
              <DropdownMenuLabel>
                {translate('dashboardPopout.filters.project', 'Project')}
              </DropdownMenuLabel>
              {projects.map((option) => (
                <DropdownMenuCheckboxItem
                  key={option.id}
                  checked={filters.projects.includes(option.id)}
                  onCheckedChange={() => toggleProject(option.id)}
                  onSelect={(event) => event.preventDefault()}
                >
                  <span className="truncate">{option.label}</span>
                  <FilterOptionCount count={option.count} />
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>
                {translate('dashboardPopout.filters.workspaceStatus', 'Workspace status')}
              </DropdownMenuLabel>
              {statuses.map((option) => {
                const meta = getWorkspaceStatusVisualMeta({
                  id: option.id,
                  label: option.label,
                  color: option.color
                })
                return (
                  <DropdownMenuCheckboxItem
                    key={option.id}
                    checked={filters.workspaceStatuses.includes(option.id)}
                    onCheckedChange={() => toggleStatus(option.id)}
                    onSelect={(event) => event.preventDefault()}
                  >
                    <span className={cn('size-2 rounded-full', meta.swatch)} />
                    <span className="truncate">{option.label}</span>
                    <FilterOptionCount count={option.count} />
                  </DropdownMenuCheckboxItem>
                )
              })}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>
                {translate('dashboardPopout.filters.reviewStatus', 'PR / MR status')}
              </DropdownMenuLabel>
              {REVIEW_OPTIONS.map((option) => (
                <DropdownMenuCheckboxItem
                  key={option}
                  checked={filters.reviewStates.includes(option)}
                  onCheckedChange={() => toggleReview(option)}
                  onSelect={(event) => event.preventDefault()}
                >
                  <span>{reviewStateLabel(option)}</span>
                  <FilterOptionCount count={reviewCounts.get(option) ?? 0} />
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={activeCount === 0}
                onSelect={clearFilters}
                className="text-muted-foreground"
              >
                <X className="size-3.5" />
                {translate('dashboardPopout.filters.clearAll', 'Clear all filters')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {!filterControl && activeCount > 0 ? (
        <AgentDashboardFilterChips
          filters={filters}
          projects={projects}
          statuses={statuses}
          reviewLabel={reviewLabel}
          onProjectToggle={toggleProject}
          onStatusToggle={toggleStatus}
          onReviewToggle={toggleReview}
          onClear={clearFilters}
        />
      ) : null}
    </>
  )
}
