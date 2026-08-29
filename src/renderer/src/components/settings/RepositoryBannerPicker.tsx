import { ImageIcon, Sparkles, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { translate } from '@/i18n/i18n'
import { useMountedRef } from '@/hooks/useMountedRef'
import { useAppStore } from '../../store'
import { SearchableSetting } from './SearchableSetting'
import { cn } from '@/lib/utils'
import {
  defaultRepoBannerVariant,
  REPO_BANNER_VARIANTS,
  sanitizeRepoBanner,
  type RepoBannerVariant
} from '../../../../shared/repo-banner'
import { projectAccentHue } from '../dashboard-popout/project-accent-hue'
import { fitImageToBanner } from './fit-image-to-banner'
import {
  bannerFromRepoCandidate,
  RepoBannerCandidateGrid,
  useRepoBannerCandidates
} from './repo-banner-candidates'
import { useAiRepoBannerSuggestions } from './ai-repo-banner-suggestions'
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
/** Reads a dropped or pasted file into the data URL the fitter expects. */
async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the image.'))
    reader.readAsDataURL(file)
  })
}

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
  const { candidates } = useRepoBannerCandidates(repo.path)
  const hasGeminiApiKey = useAppStore((state) => Boolean(state.settings?.geminiApiKey))
  const {
    suggestions: aiSuggestions,
    loading: aiLoading,
    generate: generateAiSuggestions
  } = useAiRepoBannerSuggestions()

  const applyImage = async (dataUrl: string, label: string): Promise<void> => {
    // Why fit before storing: people pick photographs, not banners. Cropping
    // and re-encoding here means the stored bytes are only the strip that will
    // ever be seen, rather than a phone shot the snapshot has to carry.
    const fitted = await fitImageToBanner(dataUrl)
    if (!mountedRef.current) {
      return
    }
    const next = fitted ? sanitizeRepoBanner({ kind: 'image', src: fitted, label }) : null
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
  }

  const handlePaste = async (event: React.ClipboardEvent<HTMLDivElement>): Promise<void> => {
    const file = [...event.clipboardData.files].find((item) => item.type.startsWith('image/'))
    if (!file) {
      return
    }
    event.preventDefault()
    await applyImage(await fileToDataUrl(file), file.name || 'pasted image')
  }

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>): Promise<void> => {
    const file = [...event.dataTransfer.files].find((item) => item.type.startsWith('image/'))
    if (!file) {
      return
    }
    event.preventDefault()
    await applyImage(await fileToDataUrl(file), file.name)
  }

  const handlePick = async (): Promise<void> => {
    try {
      // Why not the icon picker: that one is PNG-only and rejects anything over
      // 256KB, which is every screenshot and every photograph people pick here.
      // Falls back while a not-yet-restarted app still has the old preload.
      const pick = window.api.shell.pickBannerImage ?? window.api.shell.pickRepoIconImage
      const result = await pick()
      if (!result || !mountedRef.current) {
        return
      }
      await applyImage(result.dataUrl, result.fileName)
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

  const handleGenerateAiSuggestions = async (): Promise<void> => {
    try {
      await generateAiSuggestions(repo, candidates)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : translate(
              'auto.components.settings.RepositoryBannerPicker.aiFailed',
              'Failed to generate AI banner suggestions'
            )
      )
    }
  }

  return (
    <SearchableSetting
      title={translate('auto.components.settings.RepositoryBannerPicker.label', 'Board banner')}
      description={translate(
        'auto.components.settings.RepositoryBannerPicker.hint',
        'Shown behind this project’s heading on the agent board.'
      )}
      keywords={[
        'banner',
        'project banner',
        'board banner',
        'banner image',
        'image',
        'ai suggestions',
        'suggest with ai',
        'gemini'
      ]}
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
      {candidates.length > 0 ? (
        <>
          <Label className="pt-1 text-sm font-semibold">
            {translate(
              'auto.components.settings.RepositoryBannerPicker.fromRepo',
              'From this repo'
            )}
          </Label>
          <RepoBannerCandidateGrid
            candidates={candidates}
            activeLabel={usingImage ? banner.label : undefined}
            onSelect={(candidate) => {
              void bannerFromRepoCandidate(candidate).then((next) => {
                if (next) {
                  updateRepo(repo.id, { repoBanner: next })
                }
              })
            }}
          />
        </>
      ) : null}
      <Label className="pt-1 text-sm font-semibold">
        {translate(
          'auto.components.settings.RepositoryBannerPicker.aiSuggestions',
          'AI suggestions'
        )}
      </Label>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!hasGeminiApiKey || aiLoading}
          onClick={() => void handleGenerateAiSuggestions()}
        >
          <Sparkles className="size-4" aria-hidden />
          {aiLoading
            ? translate(
                'auto.components.settings.RepositoryBannerPicker.aiGenerating',
                'Generating…'
              )
            : translate(
                'auto.components.settings.RepositoryBannerPicker.aiSuggest',
                'Suggest with AI'
              )}
        </Button>
        {!hasGeminiApiKey ? (
          <span className="text-xs text-muted-foreground">
            {translate(
              'auto.components.settings.RepositoryBannerPicker.aiNoKey',
              'Add a Gemini API key in Settings → Accounts to use this.'
            )}
          </span>
        ) : null}
        {aiSuggestions.map((suggestion, index) => (
          <button
            key={`${suggestion.dataUrl.slice(0, 32)}-${index}`}
            type="button"
            aria-label={translate(
              'auto.components.settings.RepositoryBannerPicker.aiUseSuggestion',
              'Use this AI-suggested banner'
            )}
            onClick={() =>
              void applyImage(
                suggestion.dataUrl,
                translate(
                  'auto.components.settings.RepositoryBannerPicker.aiLabel',
                  'AI suggestion'
                )
              )
            }
            className="h-10 w-24 shrink-0 overflow-hidden rounded-md border border-border transition-all hover:border-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <img src={suggestion.dataUrl} alt="" className="size-full object-cover" />
          </button>
        ))}
      </div>
      <Label className="pt-1 text-sm font-semibold">
        {translate('auto.components.settings.RepositoryBannerPicker.ownImage', 'Your own image')}
      </Label>
      <div
        className="flex items-center gap-2 rounded-md focus-within:ring-2 focus-within:ring-ring"
        onPaste={(event) => void handlePaste(event)}
        onDrop={(event) => void handleDrop(event)}
        onDragOver={(event) => event.preventDefault()}
      >
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
        <span className="truncate text-xs text-muted-foreground">
          {usingImage && banner.label
            ? banner.label
            : translate(
                'auto.components.settings.RepositoryBannerPicker.dropHint',
                'or drop / paste an image here'
              )}
        </span>
      </div>
    </SearchableSetting>
  )
}
