import { ImageIcon, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { translate } from '@/i18n/i18n'
import { useMountedRef } from '@/hooks/useMountedRef'
import { SearchableSetting } from './SearchableSetting'
import { cn } from '@/lib/utils'
import {
  defaultRepoBannerVariant,
  REPO_BANNER_VARIANTS,
  sanitizeRepoBanner,
  type RepoBannerVariant
} from '../../../../shared/repo-banner'
import { projectAccentHue } from '../dashboard-popout/project-accent-hue'
import '../dashboard-popout/agent-card-state.css'
import type { Repo } from '../../../../shared/repo-types'

/**
 * Picks the banner behind this project's heading on the agent board.
 *
 * The generated options come first because they are the answer to the actual
 * problem: columns that look alike. Finding a picture that reads as "this
 * project" is real work, and a project already has a distinct one before anyone
 * opens this pane — this is where you change it, not where you earn it.
 */
export function RepositoryBannerPicker({
  repo,
  updateRepo
}: {
  repo: Repo
  updateRepo: (repoId: string, updates: Partial<Repo>) => void
}): React.JSX.Element {
  const mountedRef = useMountedRef()
  const banner = repo.repoBanner ?? null
  // Why fall back to the default: a project with no banner is still showing
  // one on the board, so this pane has to select the one it is showing.
  const activeVariant =
    banner?.kind === 'generated' ? banner.variant : defaultRepoBannerVariant(repo.id)
  const usingImage = banner?.kind === 'image'
  const hue = projectAccentHue(repo.id)

  const handlePick = async (): Promise<void> => {
    try {
      // Why the icon picker's IPC: it already enforces the size ceiling and
      // returns a validated raster data URL, which is what a banner needs too.
      const result = await window.api.shell.pickRepoIconImage()
      if (!result || !mountedRef.current) {
        return
      }
      const next = sanitizeRepoBanner({
        kind: 'image',
        src: result.dataUrl,
        label: result.fileName
      })
      if (!next) {
        toast.error(
          translate(
            'auto.components.settings.RepositoryBannerPicker.rejected',
            'That image cannot be used as a banner.'
          )
        )
        return
      }
      updateRepo(repo.id, { repoBanner: next })
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : translate(
              'auto.components.settings.RepositoryBannerPicker.failed',
              'Failed to import the banner image'
            )
      )
    }
  }

  const selectVariant = (variant: RepoBannerVariant): void => {
    updateRepo(repo.id, { repoBanner: { kind: 'generated', variant } })
  }

  return (
    <SearchableSetting
      title={translate('auto.components.settings.RepositoryBannerPicker.label', 'Board banner')}
      description={translate(
        'auto.components.settings.RepositoryBannerPicker.hint',
        'Shown behind this project’s heading on the agent board.'
      )}
      keywords={['banner', 'project banner', 'board banner', 'banner image', 'image']}
      className="space-y-2"
    >
      <Label className="text-sm font-semibold">
        {translate('auto.components.settings.RepositoryBannerPicker.generated', 'Generated')}
      </Label>
      <div className="flex flex-wrap gap-2" style={{ '--project-hue': hue } as React.CSSProperties}>
        {REPO_BANNER_VARIANTS.map((variant) => (
          <button
            key={variant}
            type="button"
            aria-label={variant}
            aria-pressed={!usingImage && activeVariant === variant}
            onClick={() => selectVariant(variant)}
            data-banner={variant}
            className={cn(
              'repo-banner h-10 w-24 rounded-md border bg-card transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
              !usingImage && activeVariant === variant
                ? 'border-foreground ring-2 ring-foreground ring-offset-2 ring-offset-background'
                : 'border-border hover:border-muted-foreground'
            )}
          />
        ))}
      </div>
      <Label className="pt-1 text-sm font-semibold">
        {translate('auto.components.settings.RepositoryBannerPicker.ownImage', 'Your own image')}
      </Label>
      <div className="flex items-center gap-2">
        {usingImage ? (
          <img
            src={banner.src}
            alt=""
            className="h-10 w-24 shrink-0 rounded-md border border-foreground object-cover ring-2 ring-foreground ring-offset-2 ring-offset-background"
          />
        ) : (
          <div className="flex h-10 w-24 shrink-0 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground">
            <ImageIcon className="size-4" aria-hidden />
          </div>
        )}
        <Button type="button" variant="outline" size="sm" onClick={() => void handlePick()}>
          {usingImage
            ? translate('auto.components.settings.RepositoryBannerPicker.replace', 'Replace')
            : translate('auto.components.settings.RepositoryBannerPicker.choose', 'Choose image')}
        </Button>
        {usingImage ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={translate(
              'auto.components.settings.RepositoryBannerPicker.remove',
              'Remove image'
            )}
            onClick={() => selectVariant(activeVariant)}
          >
            <Trash2 className="size-4" />
          </Button>
        ) : null}
        {usingImage && banner.label ? (
          <span className="truncate text-xs text-muted-foreground">{banner.label}</span>
        ) : null}
      </div>
    </SearchableSetting>
  )
}
