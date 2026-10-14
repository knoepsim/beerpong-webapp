import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MatchCard } from '../match-card';
import type { Match, Team } from '@/types';

const teamsMap: Record<string, Team> = {
  a: { id: 'a', name: 'Alpha' } as Team,
  b: { id: 'b', name: 'Bravo' } as Team,
};

const match = (overrides: Partial<Match> = {}): Match => ({
  id: 'm',
  tournament_id: 't',
  round: 1,
  position: 0,
  team_a_id: 'a',
  team_b_id: 'b',
  next_match_id: null,
  next_match_slot: null,
  table_number: null,
  created_at: '',
  status: 'ready',
  winner_team_id: null,
  cups_left: null,
  ...overrides,
});

describe('MatchCard', () => {
  it('waits without a status badge until both teams are known', () => {
    render(<MatchCard match={match({ status: 'waiting', team_b_id: null })} teamsMap={teamsMap} />);
    expect(screen.getByText('TBD')).toBeInTheDocument();
    expect(screen.queryByText('Bereit')).not.toBeInTheDocument();
    expect(screen.queryByText('Beendet')).not.toBeInTheDocument();
  });

  it('shows a ready match as ready without made-up score, timer or table', () => {
    render(<MatchCard match={match()} teamsMap={teamsMap} />);
    expect(screen.getByText('Bereit')).toBeInTheDocument();
    expect(screen.queryByText(/Tisch/)).not.toBeInTheDocument();
    expect(screen.queryByText('12:34')).not.toBeInTheDocument();
    expect(screen.queryByText('10')).not.toBeInTheDocument();
  });

  it('shows the table only when one is assigned', () => {
    render(<MatchCard match={match({ table_number: 3 })} teamsMap={teamsMap} />);
    expect(screen.getByText('Tisch 3')).toBeInTheDocument();
  });

  it('marks the winner with text and an icon, not only a color, and shows the cups left', () => {
    render(
      <MatchCard
        match={match({ status: 'finished', winner_team_id: 'b', cups_left: 3 })}
        teamsMap={teamsMap}
      />,
    );
    expect(screen.getByText(/Beendet/)).toBeInTheDocument();
    expect(screen.getByText(/3 Becher/)).toBeInTheDocument();
    expect(screen.getAllByLabelText('Gewinner')).toHaveLength(1);
    // the winner row is the one with Bravo
    expect(screen.getByText('Bravo').closest('div.flex.items-center.h-\\[40px\\]')).toContainElement(
      screen.getByLabelText('Gewinner'),
    );
  });

  it('does not mark anybody while the match is open', () => {
    render(<MatchCard match={match()} teamsMap={teamsMap} />);
    expect(screen.queryByLabelText('Gewinner')).not.toBeInTheDocument();
  });

  it('shows the finished match without cups when none were recorded', () => {
    render(<MatchCard match={match({ status: 'finished', winner_team_id: 'a' })} teamsMap={teamsMap} />);
    expect(screen.queryByText(/Becher/)).not.toBeInTheDocument();
  });
});
