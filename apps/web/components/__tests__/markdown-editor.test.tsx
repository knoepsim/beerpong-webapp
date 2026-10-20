import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MarkdownEditor } from '../markdown-editor'
import { htmlFromMarkdown, markdownFromHTML } from '@/lib/markdown-html'

describe('markdown and html', () => {
  it('turn into each other, so the description stays Markdown', () => {
    const markdown = '## Regeln\n\n* **10 Becher**\n* Gewinner bleibt am Tisch'
    const html = htmlFromMarkdown(markdown)
    expect(html).toContain('<h2>Regeln</h2>')
    expect(html).toContain('<strong>10 Becher</strong>')
    expect(markdownFromHTML(html)).toBe(markdown)
  })
})

describe('MarkdownEditor', () => {
  it('shows the saved text formatted, with a German toolbar', () => {
    render(<MarkdownEditor value={'## Regeln\n\nGewinner bleibt am Tisch.'} onChange={vi.fn()} aria-label="Beschreibung" />)
    const area = screen.getByRole('textbox', { name: 'Beschreibung' })
    expect(area.querySelector('h2')).toHaveTextContent('Regeln')
    expect(screen.getByRole('toolbar', { name: 'Formatierung' })).toBeInTheDocument()
    for (const label of ['Fett', 'Kursiv', 'Liste', 'Nummerierte Liste', 'Zitat', 'Rückgängig']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
  })
})
