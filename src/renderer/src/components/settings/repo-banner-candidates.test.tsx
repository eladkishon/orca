// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RepoBannerCandidateGrid, useRepoBannerCandidates } from './repo-banner-candidates'

const findRepoBannerCandidates = vi.fn()

function Probe({ repoPath }: { repoPath?: string }): React.JSX.Element {
  const { candidates } = useRepoBannerCandidates(repoPath)
  return <span data-testid="count">{candidates.length}</span>
}

beforeEach(() => {
  vi.clearAllMocks()
  Object.assign(window, { api: { shell: { findRepoBannerCandidates } } })
})

afterEach(cleanup)

describe('useRepoBannerCandidates', () => {
  it('offers the pictures the repo already has', async () => {
    findRepoBannerCandidates.mockResolvedValue([
      { relativePath: 'banner.png', dataUrl: 'data:image/png;base64,a' }
    ])
    render(<Probe repoPath="/repo" />)

    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('1'))
    expect(findRepoBannerCandidates).toHaveBeenCalledWith({ repoPath: '/repo' })
  })

  it('asks for nothing without a repo to look in', () => {
    render(<Probe />)

    expect(findRepoBannerCandidates).not.toHaveBeenCalled()
  })

  it('survives a client with no shell API at all', () => {
    // A paired web client has no filesystem, and the preload may not have
    // landed yet — dereferencing it either way is a crash, not a missing list.
    Object.assign(window, { api: {} })

    expect(() => render(<Probe repoPath="/repo" />)).not.toThrow()
  })

  it('shows nothing rather than an empty frame when the repo has no pictures', () => {
    const { container } = render(<RepoBannerCandidateGrid candidates={[]} onSelect={() => {}} />)

    expect(container).toBeEmptyDOMElement()
  })
})
