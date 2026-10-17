import { describe, expect, it } from 'vitest'
import { podium } from './podium'
import { fiveTeamBracket } from './test-fixtures/bracket'

const won = (winner: string) => ({ status: 'finished' as const, winner_team_id: winner, cups_left: 2 })

describe('podium', () => {
  it('is empty before the end', () => {
    expect(podium(fiveTeamBracket())).toBeNull()
  })

  it('names winner, runner-up and the shared third places', () => {
    const bracket = {
      ...fiveTeamBracket({
        m1: won('t4'),
        m2: { team_b_id: 't4', ...won('t1') },
        m3: won('t3'),
        m4: { team_a_id: 't1', team_b_id: 't3', ...won('t3') },
      }),
      champion_team_id: 't3',
    }
    expect(podium(bracket)).toEqual({ champion: 't3', runnerUp: 't1', third: ['t4', 't2'] })
  })
})
