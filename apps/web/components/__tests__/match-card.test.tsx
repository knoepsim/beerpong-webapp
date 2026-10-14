import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MatchCard } from '../match-card';
import { makeMatch } from '@/lib/test-fixtures/bracket';
import type { MatchSlot } from '@/lib/bracket-layout';
import type { Match, Team } from '@/types';

const teamsMap: Record<string, Team> = {
  a: { id: 'a', name: 'Alpha' } as Team,
  b: { id: 'b', name: 'Bravo' } as Team,
};

const slot = (overrides: Partial<Match> = {}, sources: MatchSlot['sources'] = { a: null, b: null }): MatchSlot => ({
  kind: 'match',
  number: 7,
  sources,
  match: makeMatch({ id: 'm', round: 1, position: 0, team_a_id: 'a', team_b_id: 'b', status: 'ready', ...overrides }),
});

describe('MatchCard', () => {
  it('shows the number and a ready match as ready, without made-up score or timer', () => {
    render(<MatchCard slot={slot()} teamsMap={teamsMap} />);
    expect(screen.getByText('Spiel 7')).toBeInTheDocument();
    expect(screen.getByText('Bereit')).toBeInTheDocument();
    expect(screen.queryByText('12:34')).not.toBeInTheDocument();
    expect(screen.queryByText('10')).not.toBeInTheDocument();
  });

  it('names the matches whose winners are still missing', () => {
    render(
      <MatchCard
        slot={slot({ status: 'waiting', team_a_id: 'a', team_b_id: null }, { a: null, b: 3 })}
        teamsMap={teamsMap}
      />,
    );
    expect(screen.getByText('Sieger Spiel 3')).toBeInTheDocument();
    expect(screen.queryByText('Bereit')).not.toBeInTheDocument();
  });

  it('says "Offen" for a missing team without a feeder match', () => {
    render(<MatchCard slot={slot({ status: 'waiting', team_a_id: null, team_b_id: null })} teamsMap={teamsMap} />);
    expect(screen.getAllByText('Offen')).toHaveLength(2);
  });

  it('shows the table of matches that are ready or still waiting, with a placeholder until one is assigned', () => {
    const { rerender } = render(<MatchCard slot={slot()} teamsMap={teamsMap} />);
    expect(screen.getByText('Tisch folgt')).toBeInTheDocument();

    rerender(<MatchCard slot={slot({ status: 'waiting', team_b_id: null })} teamsMap={teamsMap} />);
    expect(screen.getByText('Tisch folgt')).toBeInTheDocument();

    rerender(<MatchCard slot={slot({ table_number: 3 })} teamsMap={teamsMap} />);
    expect(screen.getByText('Tisch 3')).toBeInTheDocument();
    expect(screen.queryByText('Tisch folgt')).not.toBeInTheDocument();
  });

  it('shows no table for a finished match unless one was recorded', () => {
    const { rerender } = render(<MatchCard slot={slot({ status: 'finished', winner_team_id: 'a' })} teamsMap={teamsMap} />);
    expect(screen.queryByText(/Tisch/)).not.toBeInTheDocument();

    rerender(<MatchCard slot={slot({ status: 'finished', winner_team_id: 'a', table_number: 2 })} teamsMap={teamsMap} />);
    expect(screen.getByText('Tisch 2')).toBeInTheDocument();
  });

  it('marks the winner with an icon and text, not only a color, and shows the cups left', () => {
    render(<MatchCard slot={slot({ status: 'finished', winner_team_id: 'b', cups_left: 3 })} teamsMap={teamsMap} />);
    expect(screen.getByText('3 Becher')).toBeInTheDocument();
    expect(screen.getAllByLabelText('Gewinner')).toHaveLength(1);
    expect(screen.getByText('Bravo').closest('div')).toContainElement(screen.getByLabelText('Gewinner'));
    expect(screen.getByText('Alpha').closest('div')!.className).toContain('text-muted-foreground');
  });

  it('does not mark anybody while the match is open', () => {
    render(<MatchCard slot={slot()} teamsMap={teamsMap} />);
    expect(screen.queryByLabelText('Gewinner')).not.toBeInTheDocument();
  });

  it('says "Beendet" when no cups were recorded', () => {
    render(<MatchCard slot={slot({ status: 'finished', winner_team_id: 'a' })} teamsMap={teamsMap} />);
    expect(screen.getByText('Beendet')).toBeInTheDocument();
  });

  it('describes the whole match for screen readers', () => {
    render(<MatchCard slot={slot({ status: 'finished', winner_team_id: 'a', cups_left: 2, table_number: 4 })} teamsMap={teamsMap} />);
    expect(
      screen.getByRole('group', { name: 'Spiel 7, Alpha (rot) gegen Bravo (blau), beendet, Sieger Alpha, 2 Becher übrig, Tisch 4' }),
    ).toBeInTheDocument();
  });

  it('colors the first team red and the second blue, and fades the stripe of the loser', () => {
    const { rerender } = render(<MatchCard slot={slot()} teamsMap={teamsMap} />);
    const row = (name: string) => screen.getByText(name).closest('div')!;

    expect(row('Alpha').className).toContain('border-l-red-500');
    expect(row('Alpha').className).not.toContain('border-l-red-500/30');
    expect(row('Bravo').className).toContain('border-l-blue-500');

    rerender(<MatchCard slot={slot({ status: 'finished', winner_team_id: 'a' })} teamsMap={teamsMap} />);
    expect(row('Alpha').className).toContain('bg-red-500/10');
    expect(row('Bravo').className).toContain('border-l-blue-500/30');
    expect(row('Bravo').className).not.toContain('bg-blue-500/10');
  });

  it('keeps the colors on open slots, but faded', () => {
    render(<MatchCard slot={slot({ status: 'waiting', team_b_id: null }, { a: null, b: 3 })} teamsMap={teamsMap} />);
    expect(screen.getByText('Sieger Spiel 3').closest('div')!.className).toContain('border-l-blue-500/30');
  });

  it('stands out while it can be played and not afterwards', () => {
    const { rerender } = render(<MatchCard slot={slot()} teamsMap={teamsMap} />);
    expect(screen.getByRole('group').className).toContain('border-primary/50');

    rerender(<MatchCard slot={slot({ status: 'finished', winner_team_id: 'a' })} teamsMap={teamsMap} />);
    expect(screen.getByRole('group').className).not.toContain('border-primary/50');
  });

  it('becomes a button with a handler', () => {
    const onClick = vi.fn();
    render(<MatchCard slot={slot()} teamsMap={teamsMap} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: /Spiel 7/ }));
    expect(onClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'm' }));
  });
});
