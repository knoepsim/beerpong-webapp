import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { BracketView } from '../bracket-view';
import { fiveTeamBracket, fiveTeams, makeMatch } from '@/lib/test-fixtures/bracket';
import type { Bracket } from '@/types';

const finished = (winner: string, cups = 3) => ({ status: 'finished' as const, winner_team_id: winner, cups_left: cups });

describe('BracketView', () => {
  it('draws every round as a column with its name', () => {
    render(<BracketView bracket={fiveTeamBracket()} teamsMap={fiveTeams} />);

    const columns = screen.getAllByRole('region');
    expect(columns.map((c) => c.getAttribute('aria-label'))).toEqual(['Viertelfinale', 'Halbfinale', 'Finale']);
    expect(screen.queryByText(/beendet/)).not.toBeInTheDocument(); // no progress counter in the headers
  });

  it('shows byes as their own card in round one', () => {
    render(<BracketView bracket={fiveTeamBracket()} teamsMap={fiveTeams} />);
    const round1 = screen.getByRole('region', { name: 'Viertelfinale' });

    expect(within(round1).getAllByText('Freilos')).toHaveLength(3);
    expect(within(round1).getByRole('article', { name: /Team 1, Freilos/ })).toBeInTheDocument();
  });

  it('names where an open slot comes from instead of "TBD"', () => {
    render(<BracketView bracket={fiveTeamBracket()} teamsMap={fiveTeams} />);

    expect(screen.getByText('Sieger Spiel 1')).toBeInTheDocument(); // semi-final, slot b
    expect(screen.getByText('Sieger Spiel 2')).toBeInTheDocument(); // final
    expect(screen.getByText('Sieger Spiel 3')).toBeInTheDocument();
  });

  it('numbers the matches', () => {
    render(<BracketView bracket={fiveTeamBracket()} teamsMap={fiveTeams} />);
    ['Spiel 1', 'Spiel 2', 'Spiel 3', 'Spiel 4'].forEach((label) => expect(screen.getByTitle(label)).toHaveTextContent(label.slice(6)));
  });

  it('falls back to "Unbekannt" for a team that is not in the map', () => {
    render(<BracketView bracket={fiveTeamBracket()} teamsMap={{}} />);
    expect(screen.getAllByText('Unbekannt').length).toBeGreaterThan(0);
  });

  it('always shows every round, also when the first ones are played, and has no round chips', () => {
    const bracket = fiveTeamBracket({ m1: finished('t4') });
    render(<BracketView bracket={bracket} teamsMap={fiveTeams} />);

    expect(screen.getAllByRole('region').map((c) => c.getAttribute('aria-label'))).toEqual([
      'Viertelfinale',
      'Halbfinale',
      'Finale',
    ]);
    expect(screen.queryByRole('group', { name: 'Erste angezeigte Runde' })).not.toBeInTheDocument();
    expect(screen.queryByText(/ausgeblendet/)).not.toBeInTheDocument();
  });

  it('shows the table only of matches that can be played, not of played or waiting ones', () => {
    const bracket = fiveTeamBracket({ m1: finished('t4') });
    render(<BracketView bracket={bracket} teamsMap={fiveTeams} />);

    // only match 3 is ready; match 1 is played, match 2 and the final wait for their teams
    expect(screen.getAllByText(/^Tisch \d$/)).toHaveLength(1);
  });

  it('scrolls sideways only', () => {
    const { container } = render(<BracketView bracket={fiveTeamBracket()} teamsMap={fiveTeams} />);
    const scroller = container.querySelector('.overflow-x-auto')!;
    expect(scroller.className).not.toContain('overflow-auto');
    expect(scroller.className).not.toContain('max-h');
  });

  it('highlights every round that has matches that can be played', () => {
    // match 1 (first round) and match 3 (semi-final) are both ready: two active rounds
    render(<BracketView bracket={fiveTeamBracket()} teamsMap={fiveTeams} />);
    expect(within(screen.getByRole('region', { name: 'Viertelfinale' })).getByText('Aktuell')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Halbfinale' })).getByText('Aktuell')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Finale' })).queryByText('Aktuell')).not.toBeInTheDocument();
  });

  it('highlights only the round that is still active once the first one is played', () => {
    render(<BracketView bracket={fiveTeamBracket({ m1: finished('t4') })} teamsMap={fiveTeams} />);
    expect(screen.getAllByText('Aktuell')).toHaveLength(1);
    expect(within(screen.getByRole('region', { name: 'Halbfinale' })).getByText('Aktuell')).toBeInTheDocument();
  });

  it('draws the lines of teams that moved on dark and the others light', () => {
    const lines = (container: HTMLElement, state: 'done' | 'pending') =>
      container.querySelectorAll(`[data-line="${state}"]`).length;

    // fresh: the three byes have moved on, everything else is still open
    const fresh = render(<BracketView bracket={fiveTeamBracket()} teamsMap={fiveTeams} />);
    expect(lines(fresh.container, 'done')).toBeGreaterThan(0);
    expect(lines(fresh.container, 'pending')).toBeGreaterThan(0);
    fresh.unmount();

    // a semi-final has a winner now: its line to the final turns dark as well
    const played = fiveTeamBracket({ m1: finished('t4'), m3: finished('t2') });
    const { container } = render(<BracketView bracket={played} teamsMap={fiveTeams} />);
    expect(lines(container, 'done')).toBeGreaterThan(0);
  });

  it('puts the whole tree on one surface instead of alternating columns', () => {
    render(<BracketView bracket={fiveTeamBracket()} teamsMap={fiveTeams} />);
    const columns = screen.getAllByRole('region');
    expect(columns.some((c) => c.className.includes('bg-muted'))).toBe(false);
    expect(columns[0].closest('.bg-muted')).not.toBeNull();
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

    const mine = screen.getByRole('article', { name: /Spiel 1,/ });
    expect(mine.className).toContain('ring-primary');
    expect(screen.getByRole('article', { name: /Spiel 3,/ }).className).not.toContain('ring-primary');
  });

  it('highlights the own team when it has a bye', () => {
    render(<BracketView bracket={fiveTeamBracket()} teamsMap={fiveTeams} highlightTeamId="t2" />);
    expect(screen.getByRole('article', { name: /Team 2, Freilos/ }).className).toContain('ring-primary');
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
    expect(screen.getByRole('article', { name: /Spiel 1,/ })).toBeInTheDocument();
  });

  it('renders nothing without a bracket', () => {
    const { container } = render(
      <BracketView bracket={{ tournament_id: 't', total_rounds: 0, champion_team_id: null, matches: [] }} teamsMap={{}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
