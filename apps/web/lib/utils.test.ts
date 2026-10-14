import { describe, expect, it } from 'vitest'
import { roundLabel } from './utils'

describe('roundLabel', () => {
  it('names the rounds counted back from the final', () => {
    // 16 slots: Achtelfinale -> Viertelfinale -> Halbfinale -> Finale
    expect([1, 2, 3, 4].map((r) => roundLabel(r, 4))).toEqual([
      'Achtelfinale',
      'Viertelfinale',
      'Halbfinale',
      'Finale',
    ])
  })

  it('falls back to numbered rounds for bigger brackets', () => {
    expect(roundLabel(1, 5)).toBe('Runde 1')
    expect(roundLabel(2, 5)).toBe('Achtelfinale')
  })

  it('handles a bracket with only a final', () => {
    expect(roundLabel(1, 1)).toBe('Finale')
  })

  it('keeps a number for rounds beyond total_rounds', () => {
    expect(roundLabel(3, 1)).toBe('Runde 3')
  })
})
