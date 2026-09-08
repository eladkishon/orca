// @vitest-environment happy-dom

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EndSessionButton } from './EndSessionButton'

describe('EndSessionButton', () => {
  it('still arms before ending when it is the icon-only control on a card', () => {
    const onEnd = vi.fn()
    render(<EndSessionButton appearance="icon" onEnd={onEnd} />)
    const button = screen.getByRole('button', { name: 'End session' })

    // Icon-only: the label is the accessible name, not visible text.
    expect(button.textContent).toBe('')

    fireEvent.click(button)
    expect(onEnd).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Confirm ending this session' }))
    expect(onEnd).toHaveBeenCalledOnce()
  })
})
