import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { BracketView } from '../bracket-view';
import { fiveTeamBracket, fiveTeams, makeMatch } from '@/lib/test-fixtures/bracket';
import type { Bracket } from '@/types';

const finished = (winner: string, cups = 3) => ({ status: 'finished' as const, winner_team_id: winner, cups_left: cups });

describe('BracketView', () => {
  it('draws every round as a column with its name and progress', () => {
    render(<BracketView bracket={fiveTeamBracket()} teamsMap={fiveTeams} />);

    const columns = screen.getAllByRole('region');
    expect(columns.map((c) => c.getAttribute('aria-label'))).toEqual(['Viertelfinale', 'Halbfinale', 'Finale']);
    expect(within(columns[0]).getByText('0 von 1 beendet')).toBeInTheDocument();
  });

  it('shows byes as their own card in round one', () => {
    render(<BracketView bracket={fiveTeamBracket()} teamsMap={fiveTeams} />);
    const round1 = screen.getByRole('region', { name: 'Viertelfinale' });

    expect(within(round1).getAllByText('Freilos')).toHaveLength(3);
    expect(within(round1).getByRole('group', { name: /Team 1, Freilos/ })).toBeInTheDocument();
  });

  it('names where an open slot comes from instead of "TBD"', () => {
    render(<BracketView bracket={fiveTeamBracket()} teamsMap={fiveTeams} />);

    expect(screen.getByText('Sieger Spiel 1')).toBeInTheDocument(); // semi-final, slot b
    expect(screen.getByText('Sieger Spiel 2')).toBeInTheDocument(); // final
    expect(screen.getByText('Sieger Spiel 3')).toBeInTheDocument();
  });

  it('numbers the matches', () => {
    render(<BracketView bracket={fiveTeamBracket()} teamsMap={fiveTeams} />);
    ['Spiel 1', 'Spiel 2', 'Spiel 3', 'Spiel 4'].forEach((label) => expect(screen.getByText(label)).toBeInTheDocument());
  });

  it('falls back to "Unbekannt" for a team that is not in the map', () => {
    render(<BracketView bracket={fiveTeamBracket()} teamsMap={{}} />);
    expect(screen.getAllByText('Unbekannt').length).toBeGreaterThan(0);
  });

  it('hides rounds that are completely played and says so', () => {
    const bracket = fiveTeamBracket({ m1: finished('t4') });
    render(<BracketView bracket={bracket} teamsMap={fiveTeams} />);

    expect(screen.queryByRole('region', { name: 'Viertelfinale' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Halbfinale' })).toBeInTheDocument();
    expect(screen.getByText('1 Spiel aus früheren Runden ausgeblendet.')).toBeInTheDocument();
  });

  it('brings hidden rounds back with the round chips', () => {
    render(<BracketView bracket={fiveTeamBracket({ m1: finished('t4') })} teamsMap={fiveTeams} />);

    const chips = screen.getByRole('group', { name: 'Erste angezeigte Runde' });
    expect(within(chips).getByRole('button', { name: 'Halbfinale' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(within(chips).getByRole('button', { name: 'Viertelfinale' }));

    expect(screen.getByRole('region', { name: 'Viertelfinale' })).toBeInTheDocument();
    expect(within(chips).getByRole('button', { name: 'Viertelfinale' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText(/ausgeblendet/)).not.toBeInTheDocument();
  });

  it('offers no round chips for a bracket with two rounds or fewer', () => {
    const final: Bracket = {
      tournament_id: 't', total_rounds: 2, champion_team_id: null,
      matches: [
        makeMatch({ id: 'a', round: 1, position: 0, team_a_id: 't1', team_b_id: 't2', next_match_id: 'f', next_match_slot: 'a', status: 'ready' }),
        makeMatch({ id: 'b', round: 1, position: 1, team_a_id: 't3', team_b_id: 't4', next_match_id: 'f', next_match_slot: 'b', status: 'ready' }),
        makeMatch({ id: 'f', round: 2, position: 0 }),
      ],
    };
    render(<BracketView bracket={final} teamsMap={fiveTeams} />);
    expect(screen.queryByRole('group', { name: 'Erste angezeigte Runde' })).not.toBeInTheDocument();
  });

  it('shows the trophy only in the final', () => {
    const decided = fiveTeamBracket({
      m1: finished('t4'),
      m2: finished('t1'),
      m3: finished('t2'),
      m4: { team_a_id: 't1', team_b_id: 't2', ...finished('t1') },
    });
    render(<BracketView bracket={{ ...decided, champion_team_id: 't1' }} teamsMap={fiveTeams} />);

    expect(screen.getAllByLabelText('Turniersieger')).toHaveLength(1);
    expect(within(screen.getByRole('region', { name: 'Finale' })).getByLabelText('Turniersieger')).toBeInTheDocument();
  });

  it('highlights the matches of the own team', () => {
    render(<BracketView bracket={fiveTeamBracket()} teamsMap={fiveTeams} highlightTeamId="t4" />);

    const mine = screen.getByRole('group', { name: /Spiel 1,/ });
    expect(mine.className).toContain('ring-primary');
    expect(screen.getByRole('group', { name: /Spiel 3,/ }).className).not.toContain('ring-primary');
  });

  it('highlights the own team when it has a bye', () => {
    render(<BracketView bracket={fiveTeamBracket()} teamsMap={fiveTeams} highlightTeamId="t2" />);
    expect(screen.getByRole('group', { name: /Team 2, Freilos/ }).className).toContain('ring-primary');
  });

  it('reports clicks on a match', () => {
    const onMatchClick = vi.fn();
    render(<BracketView bracket={fiveTeamBracket()} teamsMap={fiveTeams} onMatchClick={onMatchClick} />);

    fireEvent.click(screen.getByRole('button', { name: /Spiel 1,/ }));
    expect(onMatchClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'm1' }));
  });

  it('is not clickable without a handler', () => {
    render(<BracketView bracket={fiveTeamBracket()} teamsMap={fiveTeams} />);
    expect(screen.queryByRole('button', { name: /Spiel 1,/ })).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: /Spiel 1,/ })).toBeInTheDocument();
  });

  it('renders nothing without a bracket', () => {
    const { container } = render(
      <BracketView bracket={{ tournament_id: 't', total_rounds: 0, champion_team_id: null, matches: [] }} teamsMap={{}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
