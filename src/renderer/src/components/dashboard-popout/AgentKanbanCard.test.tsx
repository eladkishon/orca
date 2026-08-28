// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DashboardCard } from '../../../../shared/dashboard-snapshot'
import { i18n } from '@/i18n/i18n'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AgentKanbanCard } from './AgentKanbanCard'

const agentIconRender = vi.fn()
const agentStateDotRender = vi.fn()

vi.mock('@/lib/agent-catalog', () => ({
  AgentIcon: () => {
    agentIconRender()
    return <span data-testid="agent-icon" />
  }
}))

vi.mock('@/components/AgentStateDot', () => ({
  AgentStateDot: ({ state }: { state: string }) => {
    agentStateDotRender(state)
    return <span data-testid="state-dot" />
  }
}))

function card(overrides: Partial<DashboardCard> = {}): DashboardCard {
  return {
    paneKey: 'tab:leaf',
    ptyId: 'pty-1',
    agentType: 'claude',
    bucket: 'working',
    dotState: 'working',
    task: 'Review the change',
    repoId: 'repo-1',
    worktreeId: 'worktree-1',
    tabId: 'tab',
    leafId: 'leaf',
    repoName: 'Orca',
    worktreeName: 'dashboard-review',
    startedAt: 1_000,
    finishedAt: null,
    stateChangedAt: 1_000,
    unseen: false,
    ...overrides
  }
}

function renderCard(props: {
  card: DashboardCard
  now: number
  onOpenTerminal?: () => void
  onRemoveWorkspace?: (card: DashboardCard) => void
  density?: 'compact' | 'detailed'
}): ReturnType<typeof render> {
  return render(
    <TooltipProvider>
      <AgentKanbanCard
        card={props.card}
        now={props.now}
        onOpenTerminal={props.onOpenTerminal ?? vi.fn()}
        onRemoveWorkspace={props.onRemoveWorkspace}
        density={props.density}
      />
    </TooltipProvider>
  )
}

describe('AgentKanbanCard', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('does not render an invented age when the start time is unknown', () => {
    renderCard({ card: card({ startedAt: 0 }), now: 2_000_000_000 })

    expect(screen.queryByText(/\d+d/)).not.toBeInTheDocument()
  })

  it('shows the question glyph once when a summary is available', () => {
    const attentionCard = card({
      bucket: 'attention',
      dotState: 'waiting',
      askSummary: 'Approve deploy?'
    })
    const { container, rerender } = renderCard({ card: attentionCard, now: 2_000 })

    // The card carries no state glyph at all now — state is the border — so the
    // question mark is the only marker, present exactly once.
    expect(screen.queryByTestId('state-dot')).not.toBeInTheDocument()
    expect(container.querySelectorAll('.lucide-message-circle-question-mark')).toHaveLength(1)

    rerender(
      <TooltipProvider>
        <AgentKanbanCard
          card={{ ...attentionCard, askSummary: undefined }}
          now={2_000}
          onOpenTerminal={vi.fn()}
        />
      </TooltipProvider>
    )
    expect(screen.queryByTestId('state-dot')).not.toBeInTheDocument()
    expect(container.querySelector('.lucide-message-circle-question-mark')).toBeNull()
  })

  it('shows the saved SSH host beside the repository metadata', () => {
    const { container } = renderCard({
      card: card({
        hostKind: 'ssh',
        executionHostId: 'ssh:opaque-target',
        hostLabel: 'openclaw'
      }),
      now: 2_000
    })

    expect(screen.getByLabelText('SSH host · openclaw')).toHaveAttribute(
      'data-dashboard-host-badge',
      'ssh'
    )
    expect(container.querySelector('.lucide-server')).toBeInTheDocument()
  })

  it('shows review metadata and expands grouped subagents without opening the terminal', () => {
    const onOpenTerminal = vi.fn()
    renderCard({
      card: card({
        review: { number: 11012, state: 'open' },
        subagents: [
          { id: 'child-1', name: 'Review loop', dotState: 'working' },
          { id: 'child-2', name: 'Smoke tests', dotState: 'done' }
        ]
      }),
      now: 2_000,
      onOpenTerminal
    })

    expect(screen.getByText('#11012')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Open review #11012' })).toBeInTheDocument()
    expect(screen.queryByText('Review loop')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '2 subagents' }))
    expect(screen.getByText('Review loop')).toBeInTheDocument()
    expect(screen.getByText('Smoke tests')).toBeInTheDocument()
    expect(onOpenTerminal).not.toHaveBeenCalled()
  })

  it('opens the terminal from the footer while keeping subagent disclosure isolated', () => {
    const onOpenTerminal = vi.fn()
    renderCard({
      card: card({
        conversationName: 'Dashboard review',
        review: { number: 11042, state: 'open' },
        subagents: [{ id: 'child-1', name: 'Review loop', dotState: 'working' }]
      }),
      now: 61_000,
      onOpenTerminal
    })

    fireEvent.click(screen.getByText('dashboard-review'))
    expect(onOpenTerminal).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: '1 subagent' }))
    expect(onOpenTerminal).toHaveBeenCalledTimes(1)
  })

  it('offers removal only on an idle card, and names the worktree it would delete', () => {
    const onRemoveWorkspace = vi.fn()
    const { rerender } = renderCard({
      card: card({ bucket: 'working', dotState: 'working' }),
      now: 2_000,
      onRemoveWorkspace
    })
    expect(screen.queryByRole('button', { name: 'Remove worktree' })).not.toBeInTheDocument()

    rerender(
      <TooltipProvider>
        <AgentKanbanCard
          card={card({ bucket: 'idle', dotState: 'idle' })}
          now={2_000}
          onOpenTerminal={() => {}}
          onRemoveWorkspace={onRemoveWorkspace}
        />
      </TooltipProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Remove worktree' }))

    expect(onRemoveWorkspace).toHaveBeenCalledTimes(1)
    expect(onRemoveWorkspace.mock.calls[0][0]).toMatchObject({ worktreeId: 'worktree-1' })
  })

  it('names the command the agent is running', () => {
    renderCard({ card: card({ activity: 'Bash: pnpm test' }), now: 2_000 })

    expect(screen.getByText('Bash: pnpm test')).toBeInTheDocument()
  })

  it('reserves the activity row even with nothing to say, so cards do not jump', () => {
    // A row that appears and disappears resizes every card as its agent moves
    // between tools, and the whole board shifts under the pointer.
    const { container: empty } = renderCard({ card: card({ activity: undefined }), now: 2_000 })
    const emptyRow = empty.querySelector('[data-agent-card-activity]')
    expect(emptyRow).toBeInTheDocument()

    cleanup()
    const { container: filled } = renderCard({
      card: card({ activity: 'Bash: pnpm test' }),
      now: 2_000
    })

    expect(filled.querySelector('[data-agent-card-activity]')?.className).toBe(emptyRow?.className)
  })

  it('gives the agent more room in detailed mode', () => {
    const detail = card({ lastAgentMessage: 'A long explanation of what it did.' })
    const { container: compact } = renderCard({ card: detail, now: 2_000 })
    const compactMessage = compact.querySelector('.line-clamp-2')
    expect(compactMessage).toBeInTheDocument()

    cleanup()
    const { container: detailed } = renderCard({ card: detail, now: 2_000, density: 'detailed' })

    // The clamp is the legibility lever: same text, more of it visible.
    expect(detailed.querySelector('.line-clamp-2')).toBeNull()
    expect(detailed.querySelector('.line-clamp-\\[6\\]')).toBeInTheDocument()
  })

  it('opens the subagent list in detailed mode, rather than hiding it behind a disclosure', () => {
    const withChild = card({ subagents: [{ id: 'c1', name: 'Review loop', dotState: 'working' }] })
    renderCard({ card: withChild, now: 2_000, density: 'detailed' })

    expect(screen.getByText('Review loop')).toBeInTheDocument()
  })

  it('condenses a tool dump instead of letting it fill the card', () => {
    // lastAgentMessage is whatever the agent last said — often a grep hit or a
    // stack trace, not prose. The card shows the headline, not the article.
    const dump = [
      'Exit code 1',
      '18: /** The accessible name. */',
      '46: // Drag refs (not state to avoid re-renders during drag)',
      '227: Fluid ships this file written against Base UI'
    ].join('\n')
    renderCard({ card: card({ lastAgentMessage: dump }), now: 2_000 })

    const shown = screen.getByText(/Exit code 1/).textContent ?? ''
    expect(shown).not.toContain('18:')
    expect(shown).not.toContain('/**')
    expect(shown.length).toBeLessThan(dump.length)
  })

  it('names why a stalled agent stopped, on the frame', () => {
    const quiet = { statusUpdatedAt: 1_000, stateChangedAt: 1_000 }
    const late = 1_000 + 5 * 60_000

    // A detected cause is authoritative.
    renderCard({ card: card({ ...quiet, stallReason: 'Network' }), now: late })
    expect(screen.getByText('Network')).toBeInTheDocument()

    cleanup()
    // Otherwise the running tool is already most of the answer.
    renderCard({ card: card({ ...quiet, activity: 'Bash: pnpm build' }), now: late })
    expect(screen.getByText('Waiting on Bash')).toBeInTheDocument()

    cleanup()
    // An advancing agent has no reason to give, so the frame stays clean.
    renderCard({ card: card({ ...quiet, stallReason: 'Network' }), now: 2_000 })
    expect(screen.queryByText('Network')).not.toBeInTheDocument()
  })

  it('does not print the prompt twice when the title came from it', () => {
    // The heading and the "You" line were the same sentence, one above the
    // other, with the heading cut short — so the card spent its two best lines
    // saying one thing badly.
    renderCard({
      card: card({
        conversationName: 'Reduce textual overload',
        titleFromPrompt: true,
        lastUserMessage: 'reduce textual overload [Image #6]'
      }),
      now: 2_000
    })

    expect(screen.getByText('Reduce textual overload')).toBeInTheDocument()
    expect(screen.queryByText(/reduce textual overload \[Image/)).not.toBeInTheDocument()
  })

  it('keeps the prompt when the title came from somewhere else', () => {
    renderCard({
      card: card({ conversationName: 'Linear work log', lastUserMessage: 'add a filter' }),
      now: 2_000
    })

    expect(screen.getByText('add a filter')).toBeInTheDocument()
  })

  it('leads the card with the kind of work, not just the command', () => {
    renderCard({ card: card({ activity: 'Bash: pnpm vitest run' }), now: 2_000 })
    expect(screen.getByText('Testing')).toBeInTheDocument()

    cleanup()
    renderCard({ card: card({ activity: 'Edit: src/app.tsx' }), now: 2_000 })
    expect(screen.getByText('Writing code')).toBeInTheDocument()

    cleanup()
    // Nothing running, nothing to claim.
    renderCard({ card: card({ activity: undefined }), now: 2_000 })
    expect(screen.queryByText('Testing')).not.toBeInTheDocument()
  })

  it('says which checkout the agent is working in', () => {
    renderCard({ card: card({ isMainWorktree: true }), now: 2_000 })
    expect(screen.getByText('main')).toBeInTheDocument()

    cleanup()
    renderCard({ card: card(), now: 2_000 })
    expect(screen.getByText('worktree')).toBeInTheDocument()
  })

  it('warms the card when a working agent stops reporting', () => {
    // dotState still says working; only the silence says it is not advancing.
    const quiet = card({ statusUpdatedAt: 1_000, stateChangedAt: 1_000 })
    const { container: fresh } = renderCard({ card: quiet, now: 2_000 })
    expect(fresh.firstElementChild).toHaveAttribute('data-agent-pace', 'advancing')

    cleanup()
    const { container: stalled } = renderCard({ card: quiet, now: 1_000 + 5 * 60_000 })
    expect(stalled.firstElementChild).toHaveAttribute('data-agent-pace', 'stalled')
  })

  it('labels one subagent accessibly and never renders a workspace-status dot', () => {
    renderCard({
      card: card({
        workspaceStatusId: 'in-review',
        workspaceStatusLabel: 'In review',
        workspaceStatusColor: 'emerald',
        subagents: [{ id: 'child-1', name: 'Review loop', dotState: 'working' }]
      }),
      now: 2_000
    })

    expect(screen.getByRole('button', { name: '1 subagent' })).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'In review' })).not.toBeInTheDocument()
  })

  it('marks unseen Done done and settles acknowledged Done to idle', () => {
    // State is the border now, keyed off data-agent-state — the stylesheet owns
    // which colour and glow each state gets.
    const { container: attention } = renderCard({
      card: card({ bucket: 'attention', dotState: 'waiting' }),
      now: 2_000
    })
    expect(attention.firstElementChild).toHaveAttribute('data-agent-state', 'waiting')

    cleanup()
    const { container: done } = renderCard({
      card: card({ bucket: 'done', dotState: 'done', unseen: true }),
      now: 2_000
    })
    expect(done.firstElementChild).toHaveAttribute('data-agent-state', 'done')

    cleanup()
    const { container: idle } = renderCard({
      card: card({ bucket: 'idle', dotState: 'done', unseen: false }),
      now: 2_000
    })
    expect(idle.firstElementChild).toHaveAttribute('data-agent-state', 'idle')
  })

  it('heads the card with the conversation name and drops the worktree to the footer', () => {
    const { container } = renderCard({
      card: card({ lastUserMessage: 'ship it', conversationName: 'Sparse-checkout parser' }),
      now: 2_000
    })

    const cardElement = container.firstElementChild!
    const header = cardElement.querySelector('button')!.firstElementChild!
    const footer = cardElement.lastElementChild!
    expect(header).toHaveTextContent('Sparse-checkout parser')
    expect(header).not.toHaveTextContent('dashboard-review')
    expect(footer).toHaveTextContent('dashboard-review')
    // The message line is attributed to the user again — the name moved up.
    expect(screen.getByText('You')).toBeInTheDocument()
  })

  it('heads the card with the worktree when no name resolves, without repeating it', () => {
    const { container } = renderCard({ card: card({ lastUserMessage: 'ship it' }), now: 2_000 })

    expect(screen.getAllByText('dashboard-review')).toHaveLength(1)
    expect(container.querySelector('button')!.firstElementChild).toHaveTextContent(
      'dashboard-review'
    )
  })

  it('skips structured-clone rerenders until visible card data or its age changes', () => {
    const onOpenTerminal = vi.fn()
    const initial = card({
      startedAt: 1_000,
      subagents: [{ id: 'child-1', name: 'Review loop', dotState: 'working' }]
    })
    const { rerender } = render(
      <TooltipProvider>
        <AgentKanbanCard card={initial} now={61_500} onOpenTerminal={onOpenTerminal} />
      </TooltipProvider>
    )
    expect(agentIconRender).toHaveBeenCalledTimes(1)
    expect(screen.getByText('1m')).toBeInTheDocument()

    // A fresh structured clone of identical data.
    rerender(
      <TooltipProvider>
        <AgentKanbanCard
          card={{ ...initial, subagents: initial.subagents?.map((subagent) => ({ ...subagent })) }}
          now={62_000}
          onOpenTerminal={onOpenTerminal}
        />
      </TooltipProvider>
    )
    expect(agentIconRender).toHaveBeenCalledTimes(1)

    rerender(
      <TooltipProvider>
        <AgentKanbanCard
          card={{ ...initial, subagents: initial.subagents?.map((subagent) => ({ ...subagent })) }}
          now={121_500}
          onOpenTerminal={onOpenTerminal}
        />
      </TooltipProvider>
    )
    expect(agentIconRender).toHaveBeenCalledTimes(2)
    expect(screen.getByText('2m')).toBeInTheDocument()
  })

  it('rerenders when a working card enters monitoring', () => {
    const initial = card()
    const { container, rerender } = renderCard({ card: initial, now: 2_000 })
    expect(container.firstElementChild).toHaveAttribute('data-agent-state', 'working')

    rerender(
      <TooltipProvider>
        <AgentKanbanCard
          card={{ ...initial, workingMode: 'monitoring' }}
          now={2_000}
          onOpenTerminal={vi.fn()}
        />
      </TooltipProvider>
    )

    // Only 'working' sweeps; monitoring holds the same hue without the motion.
    expect(container.firstElementChild).toHaveAttribute('data-agent-state', 'monitoring')
  })

  it('updates the relative age when the UI language changes', async () => {
    renderCard({ card: card({ startedAt: 1_000 }), now: 121_500 })
    expect(screen.getByText('2m')).toBeInTheDocument()

    await act(async () => {
      await i18n.changeLanguage('ja')
    })

    expect(screen.getByText('2分')).toBeInTheDocument()
  })
})
