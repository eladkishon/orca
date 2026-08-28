import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import { fitImageToBanner } from './fit-image-to-banner'
import { sanitizeRepoBanner, type RepoBanner } from '../../../../shared/repo-banner'

/**
 * Pictures the repository already contains, offered as banners.
 *
 * "What image represents this project" is a question a repo has usually already
 * answered — with a logo, a social preview, a screenshot in the README's folder
 * — so offering those beats an empty file dialog. Nothing is scanned
 * recursively: main probes a fixed list of the paths projects actually use.
 */
export function useRepoBannerCandidates(repoPath: string | undefined): {
  candidates: { relativePath: string; dataUrl: string }[]
  loading: boolean
} {
  const [candidates, setCandidates] = useState<{ relativePath: string; dataUrl: string }[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!repoPath) {
      setCandidates([])
      return
    }
    // Why guard the whole chain: `window.api.shell` is absent before the
    // preload lands and in a paired web client, and the optional call alone
    // still dereferences it.
    const find = window.api?.shell?.findRepoBannerCandidates
    if (!find) {
      setCandidates([])
      return
    }
    let cancelled = false
    setLoading(true)
    void find({ repoPath })
      .then((found) => {
        if (!cancelled) {
          setCandidates(found ?? [])
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCandidates([])
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [repoPath])

  return { candidates, loading }
}

/** Fits a repo picture the same way a chosen file is fitted, so the two routes
 *  cannot store different things. */
export async function bannerFromRepoCandidate(candidate: {
  relativePath: string
  dataUrl: string
}): Promise<RepoBanner | null> {
  const fitted = await fitImageToBanner(candidate.dataUrl)
  return fitted
    ? sanitizeRepoBanner({ kind: 'image', src: fitted, label: candidate.relativePath })
    : null
}

export function RepoBannerCandidateGrid({
  candidates,
  activeLabel,
  onSelect,
  className
}: {
  candidates: readonly { relativePath: string; dataUrl: string }[]
  activeLabel?: string
  onSelect: (candidate: { relativePath: string; dataUrl: string }) => void
  className?: string
}): React.JSX.Element | null {
  if (candidates.length === 0) {
    return null
  }
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {candidates.map((candidate) => (
        <button
          key={candidate.relativePath}
          type="button"
          title={candidate.relativePath}
          aria-label={translate(
            'auto.components.settings.RepositoryBannerPicker.useFromRepo',
            'Use {{path}} from this repo',
            { path: candidate.relativePath }
          )}
          aria-pressed={activeLabel === candidate.relativePath}
          onClick={() => onSelect(candidate)}
          className={cn(
            'h-10 w-24 shrink-0 overflow-hidden rounded-md border transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
            activeLabel === candidate.relativePath
              ? 'border-foreground ring-2 ring-foreground ring-offset-2 ring-offset-background'
              : 'border-border hover:border-muted-foreground'
          )}
        >
          <img src={candidate.dataUrl} alt="" className="size-full object-cover" />
        </button>
      ))}
    </div>
  )
}
