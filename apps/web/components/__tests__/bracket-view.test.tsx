import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { BracketView } from '../bracket-view';
import type { Bracket, Match, Team } from '@/types';

const team = (id: string, name: string) => ({ id, name }) as Team;
const teamsMap: Record<string, Team> = {
  a: team('a', 'Alpha'),
  b: team('b', 'Bravo'),
  c: team('c', 'Charlie'),
  d: team('d', 'Delta'),
};

const match = (overrides: Partial<Match> & Pick<Match, 'id' | 'round' | 'position'>): Match => ({
  tournament_id: 't',
  team_a_id: null,
  team_b_id: null,
  next_match_id: null,
  next_match_slot: null,
  table_number: null,
  created_at: '',
  status: 'waiting',
  winner_team_id: null,
  cups_left: null,
  ...overrides,
});

// Semi-final A vs B is decided (Alpha won with 4 cups left), C vs D is ready, the final waits for C/D.
const bracket: Bracket = {
  tournament_id: 't',
  total_rounds: 2,
  champion_team_id: null,
  matches: [
    match({ id: 'm2', round: 1, position: 1, team_a_id: 'c', team_b_id: 'd', next_match_id: 'f', status: 'ready' }),
    match({
      id: 'm1', round: 1, position: 0, team_a_id: 'a', team_b_id: 'b', next_match_id: 'f',
      status: 'finished', winner_team_id: 'a', cups_left: 4,
    }),
    match({ id: 'f', round: 2, position: 0, team_a_id: 'a', team_b_id: null }),
  ],
};

describe('BracketView', () => {
  it('labels the rounds and shows team names', () => {
    render(<BracketView bracket={bracket} teamsMap={teamsMap} />);

    expect(screen.getByText('Halbfinale')).toBeInTheDocument();
    expect(screen.getByText('Finale')).toBeInTheDocument();
    expect(screen.getAllByText('Alpha')).toHaveLength(2); // semi-final and final slot
    expect(screen.getByText('Delta')).toBeInTheDocument();
  });

  it('names earlier rounds in larger brackets', () => {
    render(<BracketView bracket={{ ...bracket, total_rounds: 3 }} teamsMap={teamsMap} />);
    expect(screen.getByText('Viertelfinale')).toBeInTheDocument();
    expect(screen.getByText('Halbfinale')).toBeInTheDocument();
  });

  it('shows TBD for open slots and a fallback for unknown teams', () => {
    render(<BracketView bracket={bracket} teamsMap={{ a: teamsMap.a }} />);
    expect(screen.getAllByText('Unbekannt').length).toBeGreaterThan(0);
    expect(screen.getByText('TBD')).toBeInTheDocument();
  });

  it('renders invisible placeholders for missing matches', () => {
    const sparse: Bracket = {
      ...bracket,
      matches: [match({ id: 'm1', round: 1, position: 0, team_a_id: 'a', team_b_id: 'b', status: 'ready' })],
    };
    const { container } = render(<BracketView bracket={sparse} teamsMap={teamsMap} />);
    expect(container.querySelectorAll('.invisible').length).toBeGreaterThan(0);
  });

  it('keeps matches of rounds beyond total_rounds', () => {
    const odd: Bracket = {
      ...bracket,
      total_rounds: 1,
      matches: [match({ id: 'x', round: 3, position: 0, team_a_id: 'a', team_b_id: 'b', status: 'ready' })],
    };
    render(<BracketView bracket={odd} teamsMap={teamsMap} />);
    expect(screen.getByText('Runde 3')).toBeInTheDocument();
  });

  it('reports clicks on a match', () => {
    const onMatchClick = vi.fn();
    render(<BracketView bracket={bracket} teamsMap={teamsMap} onMatchClick={onMatchClick} />);

    fireEvent.click(within(screen.getByText('Charlie').closest('button')!).getByText('Delta'));
    expect(onMatchClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'm2' }));
  });

  it('shows the trophy only in the final, not in earlier matches of the champion', () => {
    const decided: Bracket = {
      ...bracket,
      champion_team_id: 'a',
      matches: [
        match({
          id: 'm1', round: 1, position: 0, team_a_id: 'a', team_b_id: 'b', next_match_id: 'f',
          status: 'finished', winner_team_id: 'a', cups_left: 4,
        }),
        match({
          id: 'm2', round: 1, position: 1, team_a_id: 'c', team_b_id: 'd', next_match_id: 'f',
          status: 'finished', winner_team_id: 'c', cups_left: 1,
        }),
        match({
          id: 'f', round: 2, position: 0, team_a_id: 'a', team_b_id: 'c', status: 'finished',
          winner_team_id: 'a', cups_left: 2,
        }),
      ],
    };
    render(<BracketView bracket={decided} teamsMap={teamsMap} />);
    expect(screen.getAllByLabelText('Turniersieger')).toHaveLength(1);
    expect(screen.getAllByLabelText('Gewinner')).toHaveLength(2); // winners of the two semi-finals
  });

  it('shows the trophy for the champion of the final', () => {
    const final: Bracket = {
      ...bracket,
      total_rounds: 1,
      champion_team_id: 'b',
      matches: [
        match({ id: 'f', round: 1, position: 0, team_a_id: 'a', team_b_id: 'b', status: 'finished', winner_team_id: 'b', cups_left: 2 }),
      ],
    };
    const { container, rerender } = render(<BracketView bracket={final} teamsMap={teamsMap} />);
    expect(container.querySelectorAll('.text-amber-500')).toHaveLength(1);
    expect(screen.getByLabelText('Turniersieger')).toBeInTheDocument();

    rerender(<BracketView bracket={{ ...final, champion_team_id: null }} teamsMap={teamsMap} />);
    expect(container.querySelectorAll('.text-amber-500')).toHaveLength(0);
  });
});
