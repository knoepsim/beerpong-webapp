import { describe, expect, it } from 'vitest'
import { tabFromParam, tabQuery } from './tournament-tabs'

describe('tournament tabs in the address', () => {
  it('reads the German parameter and falls back to the overview', () => {
    expect(tabFromParam('spielplan')).toBe('bracket')
    expect(tabFromParam('tische')).toBe('tables')
    expect(tabFromParam(null)).toBe('overview')
    expect(tabFromParam('unsinn')).toBe('overview')
  })

  it('writes no parameter for the overview', () => {
    expect(tabQuery('teams')).toBe('?tab=teilnehmer')
    expect(tabQuery('overview')).toBe('')
  })
})
