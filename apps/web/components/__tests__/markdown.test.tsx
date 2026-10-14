import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Markdown } from '../markdown'

describe('Markdown', () => {
  it('keeps plain text plain: no bold element, no heading', () => {
    const { container } = render(<Markdown>{'Ein ganz normaler Satz.\n\nNoch ein Absatz.'}</Markdown>)

    expect(container.querySelectorAll('p')).toHaveLength(2)
    expect(container.querySelector('strong, b, h1, h2, h3')).toBeNull()
  })

  it('makes text bold only with Markdown bold', () => {
    render(<Markdown>{'Normal und **fett** und *kursiv*.'}</Markdown>)
    expect(screen.getByText('fett').tagName).toBe('STRONG')
    expect(screen.getByText('kursiv').tagName).toBe('EM')
  })

  it('renders headings as headings, a single # is the largest', () => {
    render(<Markdown>{'# Titel\n\n## Untertitel\n\nText'}</Markdown>)
    expect(screen.getByRole('heading', { level: 1, name: 'Titel' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Untertitel' })).toBeInTheDocument()
  })

  it('supports lists and GitHub tables', () => {
    const { container } = render(<Markdown>{'- eins\n- zwei\n\n| a | b |\n|---|---|\n| 1 | 2 |'}</Markdown>)
    expect(container.querySelectorAll('li')).toHaveLength(2)
    expect(container.querySelector('table')).not.toBeNull()
  })

  it('styles through the typography plugin and lets the caller add classes', () => {
    const { container } = render(<Markdown className="text-muted-foreground">Text</Markdown>)
    const wrapper = container.firstElementChild!
    expect(wrapper.className).toContain('prose')
    expect(wrapper.className).toContain('text-muted-foreground')
    expect(wrapper.className).toContain('break-words')
  })
})
