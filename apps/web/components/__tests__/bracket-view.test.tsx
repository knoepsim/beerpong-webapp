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
  ...overrides,
});

// Semi-final A vs B is decided (Alpha advanced), C vs D is open, final waits for C/D.
const bracket: Bracket = {
  tournament_id: 't',
  total_rounds: 2,
  matches: [
    match({ id: 'm2', round: 1, position: 1, team_a_id: 'c', team_b_id: 'd', next_match_id: 'f' }),
    match({ id: 'm1', round: 1, position: 0, team_a_id: 'a', team_b_id: 'b', next_match_id: 'f' }),
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

  it('marks decided matches as finished and open matches as running', () => {
    render(<BracketView bracket={bracket} teamsMap={teamsMap} />);
    // Alpha advanced from A vs B, nobody advanced from C vs D yet.
    expect(screen.getAllByText('Beendet')).toHaveLength(1);
    expect(screen.getAllByText('12:34')).toHaveLength(1);
  });

  it('shows a timer for matches that are not decided yet', () => {
    const open: Bracket = {
      ...bracket,
      matches: [match({ id: 'x', round: 1, position: 0, team_a_id: 'a', team_b_id: 'b' })],
      total_rounds: 1,
    };
    render(<BracketView bracket={open} teamsMap={teamsMap} />);
    expect(screen.getByText('12:34')).toBeInTheDocument();
  });

  it('hides the meta row until both teams are set', () => {
    const waiting: Bracket = {
      ...bracket,
      matches: [match({ id: 'x', round: 1, position: 0, team_a_id: 'a' })],
      total_rounds: 1,
    };
    render(<BracketView bracket={waiting} teamsMap={teamsMap} />);
    expect(screen.queryByText(/Tisch/)).not.toBeInTheDocument();
  });

  it('highlights the tournament winner with a trophy', () => {
    const final: Bracket = {
      ...bracket,
      total_rounds: 1,
      matches: [match({ id: 'f', round: 1, position: 0, team_a_id: 'a', team_b_id: 'b' })],
    };
    const { container, rerender } = render(
      <BracketView bracket={final} teamsMap={teamsMap} tournamentWinnerTeamId="a" />,
    );
    expect(container.querySelectorAll('.text-amber-500')).toHaveLength(1);

    rerender(<BracketView bracket={final} teamsMap={teamsMap} tournamentWinnerTeamId="b" />);
    expect(container.querySelectorAll('.text-amber-500')).toHaveLength(1);

    rerender(<BracketView bracket={final} teamsMap={teamsMap} />);
    expect(container.querySelectorAll('.text-amber-500')).toHaveLength(0);
  });

  it('marks the advancing team of the second slot', () => {
    const b2: Bracket = {
      ...bracket,
      matches: [
        match({ id: 'm1', round: 1, position: 0, team_a_id: 'a', team_b_id: 'b', next_match_id: 'f' }),
        match({ id: 'f', round: 2, position: 0, team_a_id: null, team_b_id: 'b' }),
      ],
    };
    render(<BracketView bracket={b2} teamsMap={teamsMap} />);
    expect(screen.getByText('Beendet')).toBeInTheDocument();
  });

  it('renders invisible placeholders for missing matches', () => {
    const sparse: Bracket = {
      ...bracket,
      matches: [match({ id: 'm1', round: 1, position: 0, team_a_id: 'a', team_b_id: 'b' })],
    };
    const { container } = render(<BracketView bracket={sparse} teamsMap={teamsMap} />);
    expect(container.querySelectorAll('.invisible').length).toBeGreaterThan(0);
  });

  it('keeps matches of rounds beyond total_rounds', () => {
    const odd: Bracket = {
      ...bracket,
      total_rounds: 1,
      matches: [match({ id: 'x', round: 3, position: 0, team_a_id: 'a', team_b_id: 'b' })],
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

  it('is not interactive without a click handler', () => {
    render(<BracketView bracket={bracket} teamsMap={teamsMap} />);
    const button = screen.getByText('Charlie').closest('button')!;
    expect(button.className).toContain('cursor-default');
    fireEvent.click(button);
  });
});
