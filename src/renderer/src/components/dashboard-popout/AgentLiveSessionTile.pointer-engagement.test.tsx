// @vitest-environment happy-dom

import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AgentLiveSessionTile } from './AgentLiveSessionTile'
import type { DashboardCard } from '../../../../shared/dashboard-snapshot'

vi.mock('./AgentTerminalPreview', () => ({
  AgentTerminalPreview: ({ className }: { className?: string }) => (
    <div data-testid="preview" className={className} />
  )
}))

const card = {
  paneKey: 'a',
  tabId: 't',
  worktreeId: 'w',
  worktreeName: 'main',
  repoId: 'r',
  repoName: 'orca',
  agentType: 'claude',
  state: 'working',
  ptyId: 'pty-1'
} as unknown as DashboardCard

describe('AgentLiveSessionTile', () => {
  it('leaves the wheel to the column until the tile is clicked, and gives it back on focus loss', () => {
    const { getByTestId, container } = render(
      <AgentLiveSessionTile card={card} onOpenTerminal={vi.fn()} />
    )
    const section = container.querySelector('section')!

    expect(getByTestId('preview').className).toContain('pointer-events-none')

    fireEvent.pointerDown(section)
    expect(getByTestId('preview').className).not.toContain('pointer-events-none')

    fireEvent.blur(section, { relatedTarget: document.body })
    expect(getByTestId('preview').className).toContain('pointer-events-none')
  })
})
