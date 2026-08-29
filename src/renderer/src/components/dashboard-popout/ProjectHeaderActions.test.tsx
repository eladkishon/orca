// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ProjectHeaderActions } from './ProjectHeaderActions'

vi.mock('@/lib/agent-catalog', () => ({
  AgentIcon: ({ agent }: { agent: string }) => <span data-testid={`icon-${agent}`} />,
  getAgentLabel: (agent: string) => `Label:${agent}`
}))
const toastError = vi.fn()
vi.mock('sonner', () => ({ toast: { error: (message: string) => toastError(message) } }))
vi.mock('@/components/settings/fit-image-to-banner', () => ({
  fitImageToBanner: async (src: string) =>
    src.includes('good') ? 'data:image/jpeg;base64,AAAA' : null
}))
vi.mock('@/components/settings/repo-banner-candidates', () => ({
  useRepoBannerCandidates: () => ({ candidates: [], loading: false }),
  RepoBannerCandidateGrid: () => null,
  bannerFromRepoCandidate: async () => null
}))

function renderActions(overrides: Partial<React.ComponentProps<typeof ProjectHeaderActions>> = {}) {
  return render(
    <TooltipProvider>
      <ProjectHeaderActions
        projectId="r1"
        repoPath="/repo"
        projectHue={210}
        activeVariant="aurora"
        launchableAgents={{ worktreeId: 'w1', agents: ['claude', 'hermes'] }}
        onSetBanner={vi.fn()}
        onSpawnAgent={vi.fn()}
        {...overrides}
      />
    </TooltipProvider>
  )
}

beforeEach(() => {
  Object.assign(window, { api: { shell: {} } })
})
afterEach(cleanup)

describe('ProjectHeaderActions', () => {
  it('carries the project hue into the banner popover', () => {
    // A popover renders in a portal, so it never inherits the column's own
    // variable — without this the generated swatches draw in an undefined
    // colour, which looks like nothing at all.
    renderActions()

    fireEvent.click(screen.getByRole('button', { name: 'Set banner' }))
    const content = document.querySelector('[data-slot="popover-content"]') as HTMLElement | null

    expect(content?.style.getPropertyValue('--project-hue')).toBe('210')
  })

  it('offers every generated variant to choose from', () => {
    renderActions()

    fireEvent.click(screen.getByRole('button', { name: 'Set banner' }))

    for (const variant of ['aurora', 'mesh', 'rays', 'tide', 'grain']) {
      expect(screen.getByRole('button', { name: variant })).toBeInTheDocument()
    }
  })

  it('names and pictures each agent it can start', () => {
    // A list of bare names makes you read where you could have recognised.
    renderActions()

    fireEvent.click(screen.getByRole('button', { name: 'New' }))

    expect(screen.getByTestId('icon-claude')).toBeInTheDocument()
    expect(screen.getByText('Label:hermes')).toBeInTheDocument()
  })

  it('stores a chosen picture through the banner picker, not the icon one', async () => {
    // The icon picker is PNG-only and caps at 256KB, which is every screenshot.
    const onSetBanner = vi.fn()
    const pickBannerImage = vi.fn(async () => ({
      dataUrl: 'data:image/jpeg;base64,good',
      fileName: 'shot.jpg'
    }))
    Object.assign(window, { api: { shell: { pickBannerImage } } })
    renderActions({ onSetBanner })

    fireEvent.click(screen.getByRole('button', { name: 'Set banner' }))
    fireEvent.click(screen.getByText('Choose image…'))
    await vi.waitFor(() => expect(onSetBanner).toHaveBeenCalled())
    expect(onSetBanner.mock.calls[0][1]).toMatchObject({ kind: 'image', label: 'shot.jpg' })
  })

  it('says so when the picked picture cannot be used', async () => {
    // It used to fail silently, which reads exactly like a click that missed.
    Object.assign(window, {
      api: {
        shell: {
          pickBannerImage: async () => ({
            dataUrl: 'data:image/jpeg;base64,bad',
            fileName: 'x.jpg'
          })
        }
      }
    })
    renderActions()

    fireEvent.click(screen.getByRole('button', { name: 'Set banner' }))
    fireEvent.click(screen.getByText('Choose image…'))

    await vi.waitFor(() => expect(toastError).toHaveBeenCalled())
  })

  it('still offers a new worktree when the workspace can start no agent', () => {
    renderActions({ launchableAgents: null })

    fireEvent.click(screen.getByRole('button', { name: 'New' }))

    expect(screen.getByText('New worktree')).toBeInTheDocument()
    expect(screen.queryByText('New session')).not.toBeInTheDocument()
  })
})
