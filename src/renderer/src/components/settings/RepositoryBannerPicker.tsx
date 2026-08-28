import { ImageIcon, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { translate } from '@/i18n/i18n'
import { useMountedRef } from '@/hooks/useMountedRef'
import { SearchableSetting } from './SearchableSetting'
import { sanitizeRepoBanner } from '../../../../shared/repo-banner'
import type { Repo } from '../../../../shared/repo-types'

/**
 * Picks the image shown behind this project's heading on the agent board.
 *
 * Separate from the icon above it: an icon identifies a project in a 16px box,
 * a banner sets the tone of a whole column. A project can reasonably want both,
 * and they are rarely the same picture.
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

  const handlePick = async (): Promise<void> => {
    try {
      // Why: reuse the icon picker's IPC rather than adding a second image
      // path — it already enforces the size ceiling and returns a validated
      // raster data URL, which is exactly what a banner needs too.
      const result = await window.api.shell.pickRepoIconImage()
      if (!result || !mountedRef.current) {
        return
      }
      const next = sanitizeRepoBanner({ src: result.dataUrl, label: result.fileName })
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

  return (
    <SearchableSetting
      title={translate('auto.components.settings.RepositoryBannerPicker.label', 'Board banner')}
      description={translate(
        'auto.components.settings.RepositoryBannerPicker.hint',
        'Image shown behind this project’s heading on the agent board.'
      )}
      keywords={['banner', 'project banner', 'board banner', 'banner image', 'image']}
      className="space-y-2"
    >
      <Label className="text-sm font-semibold">
        {translate('auto.components.settings.RepositoryBannerPicker.label', 'Board banner')}
      </Label>
      <p className="text-xs text-muted-foreground">
        {translate(
          'auto.components.settings.RepositoryBannerPicker.hint',
          'Image shown behind this project’s heading on the agent board.'
        )}
      </p>
      <div className="flex items-center gap-2">
        {banner ? (
          <img
            src={banner.src}
            alt=""
            className="h-10 w-28 shrink-0 rounded-md border border-border object-cover"
          />
        ) : (
          <div className="flex h-10 w-28 shrink-0 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground">
            <ImageIcon className="size-4" aria-hidden />
          </div>
        )}
        <Button type="button" variant="outline" size="sm" onClick={() => void handlePick()}>
          {banner
            ? translate('auto.components.settings.RepositoryBannerPicker.replace', 'Replace')
            : translate('auto.components.settings.RepositoryBannerPicker.choose', 'Choose image')}
        </Button>
        {banner ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={translate(
              'auto.components.settings.RepositoryBannerPicker.remove',
              'Remove banner'
            )}
            onClick={() => updateRepo(repo.id, { repoBanner: null })}
          >
            <Trash2 className="size-4" />
          </Button>
        ) : null}
        {banner?.label ? (
          <span className="truncate text-xs text-muted-foreground">{banner.label}</span>
        ) : null}
      </div>
    </SearchableSetting>
  )
}
