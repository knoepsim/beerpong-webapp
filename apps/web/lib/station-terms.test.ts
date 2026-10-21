import { describe, expect, it } from 'vitest'
import { GAMES, STATION_TERMS } from '@/components/games'
import { freeOne } from './station-terms'
import { Game } from '@/types'

describe('freeOne', () => {
  it('gives the adjective the ending of the article', () => {
    expect(freeOne(GAMES[Game.BEERPONG].station)).toBe('einen freien Tisch')
    expect(freeOne(GAMES[Game.FOOTBALL].station)).toBe('einen freien Platz')
    expect(freeOne(STATION_TERMS)).toBe('eine freie Spielstätte')
  })
})
