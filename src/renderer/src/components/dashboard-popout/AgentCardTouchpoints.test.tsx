// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AgentCardTouchpoints } from './AgentCardTouchpoints'

const openUrl = vi.fn(() => Promise.resolve())
const openFilePath = vi.fn(() => Promise.resolve(true))
const pathExists = vi.fn((path: string) => Promise.resolve(path.includes('Xcode.app')))

beforeEach(() => {
  vi.clearAllMocks()
  Object.assign(window, { api: { shell: { openUrl, openFilePath, pathExists } } })
})

afterEach(cleanup)

function renderChips(touchpoints: Parameters<typeof AgentCardTouchpoints>[0]['touchpoints']): void {
  render(
    <TooltipProvider>
      <AgentCardTouchpoints touchpoints={touchpoints} />
    </TooltipProvider>
  )
}

describe('AgentCardTouchpoints', () => {
  it('opens the exact page the agent loaded, not the site root', () => {
    renderChips([
      { kind: 'browser', label: 'localhost:3000/checkout', url: 'http://localhost:3000/checkout' }
    ])

    fireEvent.click(screen.getByText('localhost:3000/checkout'))

    expect(openUrl).toHaveBeenCalledWith('http://localhost:3000/checkout')
  })

  it('launches the simulator copy that is actually installed', async () => {
    renderChips([{ kind: 'simulator', label: 'Simulator' }])

    fireEvent.click(screen.getByText('Simulator'))
    await vi.waitFor(() => expect(openFilePath).toHaveBeenCalledTimes(1))

    expect(openFilePath).toHaveBeenCalledWith(
      '/Applications/Xcode.app/Contents/Developer/Applications/Simulator.app'
    )
  })

  it('renders nothing when the agent has touched no surface', () => {
    const { container } = render(
      <TooltipProvider>
        <AgentCardTouchpoints touchpoints={[]} />
      </TooltipProvider>
    )

    expect(container).toBeEmptyDOMElement()
  })
})
