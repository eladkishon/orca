import { useState } from 'react'
import { ImagePlus, Plus } from 'lucide-react'
import { AgentIcon, getAgentLabel } from '@/lib/agent-catalog'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { fitImageToBanner } from '@/components/settings/fit-image-to-banner'
import {
  bannerFromRepoCandidate,
  RepoBannerCandidateGrid,
  useRepoBannerCandidates
} from '@/components/settings/repo-banner-candidates'
import {
  REPO_BANNER_VARIANTS,
  sanitizeRepoBanner,
  type RepoBannerVariant
} from '../../../../shared/repo-banner'
import type { TuiAgent } from '../../../../shared/tui-agent'

/**
 * The two things you want to do to a project from the board: start work on it,
 * and make its column recognisable.
 *
 * Both live on the heading rather than in a settings pane, because that is
 * where the decision is made — a banner chosen three screens away from the
 * board it appears on is a banner nobody sets.
 */
export function ProjectHeaderActions({
  projectId,
  repoPath,
  projectHue,
  activeVariant,
  launchableAgents,
  onSetBanner,
  onSpawnAgent,
  className
}: {
  projectId: string
  /** Lets the picker offer pictures the repo already contains. */
  repoPath: string | undefined
  /** The column's own hue, which a portalled popover cannot inherit. */
  projectHue: number
  activeVariant: RepoBannerVariant
  /** Agents that can be started here, and the worktree to start them in. */
  launchableAgents: { worktreeId: string; agents: readonly TuiAgent[] } | null
  onSetBanner: (repoId: string, banner: ReturnType<typeof sanitizeRepoBanner>) => void
  onSpawnAgent: (worktreeId: string, agent: TuiAgent) => void
  className?: string
}): React.JSX.Element {
  const [busy, setBusy] = useState(false)
  const { candidates, loading, failed } = useRepoBannerCandidates(repoPath)

  const pickImage = async (): Promise<void> => {
    setBusy(true)
    try {
      // Why the fallback: the preload only reloads when the app restarts, so
      // until it does, the banner picker is missing and `?.()` would open no
      // dialog at all and report nothing. The icon picker is narrower (PNG,
      // 256KB) but it is a door that opens.
      const pick = window.api.shell.pickBannerImage ?? window.api.shell.pickRepoIconImage
      if (!pick) {
        throw new Error(
          translate('dashboardPopout.project.bannerPickerMissing', 'Restart Orca to pick an image.')
        )
      }
      const result = await pick()
      if (!result) {
        return
      }
      // Why fit here too: this is a second door onto the same setting, and a
      // door that stores something the other would reject is a bug in waiting.
      const fitted = await fitImageToBanner(result.dataUrl)
      const banner = fitted
        ? sanitizeRepoBanner({ kind: 'image', src: fitted, label: result.fileName })
        : null
      if (!banner) {
        // Why say so: a picture that cannot be read or compressed used to leave
        // the popover sitting there, indistinguishable from a click that missed.
        throw new Error(
          translate(
            'dashboardPopout.project.bannerUnusable',
            'That picture could not be used as a banner.'
          )
        )
      }
      onSetBanner(projectId, banner)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : translate('dashboardPopout.project.bannerFailed', 'Could not set the banner.')
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    // Why hidden until hover: a banner is a picture you chose to make the
    // column recognisable, and two icons parked on top of it every second of
    // the day undo that. focus-within keeps them reachable without a mouse.
    <div
      className={cn(
        'relative flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/project:opacity-100 focus-within:opacity-100',
        className
      )}
    >
      {launchableAgents && launchableAgents.agents.length > 0 ? (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={translate('dashboardPopout.project.newAgent', 'New agent')}
            >
              <Plus className="size-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" sideOffset={6} className="w-48 p-1">
            {launchableAgents.agents.map((agent) => (
              <button
                key={agent}
                type="button"
                onClick={() => onSpawnAgent(launchableAgents.worktreeId, agent)}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
              >
                {/* Why the icon: a list of bare names makes you read where you
                    could have recognised — every other agent list in Orca is
                    scannable by its logo. */}
                <AgentIcon agent={agent} size={14} />
                {getAgentLabel(agent)}
              </button>
            ))}
          </PopoverContent>
        </Popover>
      ) : null}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={translate('dashboardPopout.project.setBanner', 'Set banner')}
          >
            <ImagePlus className="size-3.5" />
          </Button>
        </PopoverTrigger>
        {/* Why the hue is set here too: a popover renders in a portal, so it
            never inherits the column's own variable — without this the
            generated swatches draw in an undefined colour, which is why they
            looked like nothing at all. */}
        <PopoverContent
          align="end"
          sideOffset={6}
          className="w-60 space-y-2 p-2"
          style={{ '--project-hue': projectHue } as React.CSSProperties}
        >
          {/* Why say so: an empty grid is indistinguishable from a read that
              failed, and both used to render as simply nothing being there. */}
          {candidates.length === 0 ? (
            <p className="px-0.5 text-[10px] text-muted-foreground">
              {loading
                ? translate('dashboardPopout.project.lookingInRepo', 'Looking in this repo…')
                : failed
                  ? translate(
                      'dashboardPopout.project.repoUnreadable',
                      'Could not read this repo’s files.'
                    )
                  : translate(
                      'dashboardPopout.project.noRepoPictures',
                      'No pictures found in this repo.'
                    )}
            </p>
          ) : null}
          {candidates.length > 0 ? (
            <>
              <p className="px-0.5 text-[10px] font-semibold text-muted-foreground">
                {translate('dashboardPopout.project.fromRepo', 'From this repo')}
              </p>
              <RepoBannerCandidateGrid
                candidates={candidates}
                onSelect={(candidate) => {
                  void bannerFromRepoCandidate(candidate).then((banner) => {
                    if (banner) {
                      onSetBanner(projectId, banner)
                    }
                  })
                }}
              />
            </>
          ) : null}
          <div className="grid grid-cols-2 gap-1.5">
            {REPO_BANNER_VARIANTS.map((variant) => (
              <button
                key={variant}
                type="button"
                aria-label={variant}
                aria-pressed={activeVariant === variant}
                data-banner={variant}
                onClick={() => onSetBanner(projectId, { kind: 'generated', variant })}
                className={cn(
                  'repo-banner h-8 rounded border bg-card transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                  activeVariant === variant
                    ? 'border-foreground ring-1 ring-foreground'
                    : 'border-border hover:border-muted-foreground'
                )}
              />
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="xs"
            disabled={busy}
            onClick={() => void pickImage()}
            className="w-full"
          >
            {translate('dashboardPopout.project.chooseImage', 'Choose image…')}
          </Button>
        </PopoverContent>
      </Popover>
    </div>
  )
}
