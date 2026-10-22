import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BackToStart } from '../back-to-start'

const params = vi.hoisted(() => ({ value: new URLSearchParams() }))
vi.mock('next/navigation', () => ({ useSearchParams: () => params.value }))

describe('BackToStart', () => {
  it('leads back to the start page whoever came from there', () => {
    params.value = new URLSearchParams('from=start')
    render(<BackToStart />)
    expect(screen.getByRole('link', { name: /Zurück zur Startseite/ })).toHaveAttribute('href', '/')
  })

  it('shows nothing to anybody else', () => {
    params.value = new URLSearchParams('redirect=/t/cup')
    render(<BackToStart />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
