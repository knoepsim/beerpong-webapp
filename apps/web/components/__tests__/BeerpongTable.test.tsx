import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { BeerpongTable } from '../BeerpongTable'

describe('BeerpongTable', () => {
  it('renders correctly with 10 cups on each side', () => {
    const { container } = render(<BeerpongTable leftCups={10} rightCups={10} />)
    
    // We expect 20 cups to be rendered (10 red, 10 blue). 
    // Since each cup is an SVG, we can query by the SVG elements.
    // The SoloCup component has an SVG inside a motion.div
    const svgs = container.querySelectorAll('svg')
    expect(svgs).toHaveLength(20)
  })

  it('renders correctly with fewer cups', () => {
    const { container } = render(<BeerpongTable leftCups={6} rightCups={3} />)
    
    const svgs = container.querySelectorAll('svg')
    expect(svgs).toHaveLength(9)
  })

  it('handles negative cup counts gracefully by rendering 0 cups for that side', () => {
    const { container } = render(<BeerpongTable leftCups={-5} rightCups={10} />)
    
    const svgs = container.querySelectorAll('svg')
    expect(svgs).toHaveLength(10)
  })

  it('handles counts greater than 10 by clamping to 10', () => {
    const { container } = render(<BeerpongTable leftCups={15} rightCups={20} />)
    
    const svgs = container.querySelectorAll('svg')
    expect(svgs).toHaveLength(20)
  })
})
