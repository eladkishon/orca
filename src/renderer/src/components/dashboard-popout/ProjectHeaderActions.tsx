import { useState } from 'react'
import { ImagePlus, Plus } from 'lucide-react'
import { AgentIcon, getAgentLabel } from '@/lib/agent-catalog'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
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
  onSpawnAgent
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
}): React.JSX.Element {
  const [busy, setBusy] = useState(false)
  const { candidates } = useRepoBannerCandidates(repoPath)

  const pickImage = async (): Promise<void> => {
    setBusy(true)
    try {
      const result = await window.api.shell.pickRepoIconImage?.()
      if (!result) {
        return
      }
      // Why fit here too: this is a second door onto the same setting, and a
      // door that stores something the other would reject is a bug in waiting.
      const fitted = await fitImageToBanner(result.dataUrl)
      const banner = fitted
        ? sanitizeRepoBanner({ kind: 'image', src: fitted, label: result.fileName })
        : null
      if (banner) {
        onSetBanner(projectId, banner)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    // Why visible rather than hover-only: a control nobody can see is a control
    // nobody has. It sits quiet until the column is hovered, but it is always
    // there to be found.
    <div className="relative flex shrink-0 items-center gap-0.5 opacity-45 transition-opacity group-hover/project:opacity-100 focus-within:opacity-100">
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
