import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import { fitImageToBanner } from './fit-image-to-banner'
import { sanitizeRepoBanner, type RepoBanner } from '../../../../shared/repo-banner'
import { findRepoBannerCandidates, type RepoBannerCandidate } from './find-repo-banner-candidates'

/**
 * Pictures the repository already contains, offered as banners.
 *
 * "What image represents this project" is a question a repo has usually already
 * answered — with a logo, a social preview, a screenshot in the README's folder
 * — so offering those beats an empty file dialog.
 */
export function useRepoBannerCandidates(repoPath: string | undefined): {
  candidates: RepoBannerCandidate[]
  loading: boolean
  /** Why surfaced: an empty grid and a failed read look identical, and the one
   *  thing worse than no pictures is no pictures and no reason. */
  failed: boolean
} {
  const [candidates, setCandidates] = useState<RepoBannerCandidate[]>([])
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!repoPath) {
      setCandidates([])
      return
    }
    const signal = { cancelled: false }
    setLoading(true)
    setFailed(false)
    void findRepoBannerCandidates(repoPath, signal)
      .then((found) => {
        if (!signal.cancelled) {
          setCandidates(found)
        }
      })
      .catch(() => {
        if (!signal.cancelled) {
          setCandidates([])
          setFailed(true)
        }
      })
      .finally(() => {
        if (!signal.cancelled) {
          setLoading(false)
        }
      })
    return () => {
      signal.cancelled = true
    }
  }, [repoPath])

  return { candidates, loading, failed }
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
