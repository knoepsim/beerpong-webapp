import { describe, expect, it } from 'vitest'
import { tabFromParam, tabQuery } from './tournament-tabs'

describe('tournament tabs in the address', () => {
  it('reads the tab as the code calls it and falls back to the overview', () => {
    expect(tabFromParam('schedule')).toBe('schedule')
    expect(tabFromParam('stations')).toBe('stations')
    expect(tabFromParam(null)).toBe('overview')
    expect(tabFromParam('unsinn')).toBe('overview')
  })

  it('writes no parameter for the overview', () => {
    expect(tabQuery('participants')).toBe('?tab=participants')
    expect(tabQuery('overview')).toBe('')
  })
})
