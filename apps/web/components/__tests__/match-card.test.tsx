import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MatchCard } from '../match-card';
import { abTeams as teamsMap, makeSlot as slot } from '@/lib/test-fixtures/bracket'

describe('MatchCard', () => {
  it('shows the number and a ready match as ready, without made-up score or timer', () => {
    render(<MatchCard slot={slot()} teamsMap={teamsMap} />);
    expect(screen.getByTitle('Spiel 7')).toHaveTextContent('7');
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

  it('shows the status with icon and short text, and the table only where to go', () => {
    const { rerender } = render(<MatchCard slot={slot()} teamsMap={teamsMap} />);
    expect(screen.getByText('Tisch 1')).toBeInTheDocument();

    rerender(<MatchCard slot={slot({ status: 'queued', table_id: null, table_name: null, queue_position: 2 })} teamsMap={teamsMap} />);
    expect(screen.getByTitle('Wartet auf Tisch, Platz 2 in der Warteschlange')).toHaveTextContent('Platz 2');
    expect(screen.queryByText(/Tisch/)).not.toBeInTheDocument();

    rerender(<MatchCard slot={slot({ status: 'waiting', team_b_id: null, table_id: null, table_name: null }, { a: null, b: 3 })} teamsMap={teamsMap} />);
    expect(screen.getByTitle('Wartet auf Team')).toHaveTextContent('Wartet');
    expect(screen.getByText('Sieger Spiel 3')).toBeInTheDocument(); // the row says where the team comes from
    expect(screen.queryByText(/Tisch/)).not.toBeInTheDocument();

    rerender(<MatchCard slot={slot({ status: 'live' })} teamsMap={teamsMap} />);
    expect(screen.getByText('Live')).toBeInTheDocument();
    expect(screen.getByText('Tisch 1')).toBeInTheDocument();

    rerender(<MatchCard slot={slot({ table_id: 't3', table_name: 'Tisch 3' })} teamsMap={teamsMap} />);
    expect(screen.getByText('Tisch 3')).toBeInTheDocument();
  });

  it('shows no table for a finished match', () => {
    render(<MatchCard slot={slot({ status: 'finished', winner_team_id: 'a', table_id: 't2', table_name: 'Tisch 2' })} teamsMap={teamsMap} />);
    expect(screen.queryByText(/Tisch/)).not.toBeInTheDocument();
  });

  it('shows the score like a scoreboard: cups left next to each team, winner bold, loser crossed out', () => {
    render(<MatchCard slot={slot({ status: 'finished', winner_team_id: 'b', score_a: 0, score_b: 3 })} teamsMap={teamsMap} />);
    expect(screen.getByText('Bravo').className).toContain('font-semibold');
    expect(screen.getByText('Alpha').className).toContain('line-through'); // not only by color
    expect(screen.getByText('Bravo').parentElement).toHaveTextContent(/Bravo3$/);
    expect(screen.getByText('Alpha').parentElement).toHaveTextContent(/Alpha0$/);
    expect(screen.queryByText('3 Becher')).not.toBeInTheDocument();
  });

  it('does not mark anybody while the match is open', () => {
    render(<MatchCard slot={slot()} teamsMap={teamsMap} />);
    expect(screen.queryByLabelText('Gewinner')).not.toBeInTheDocument();
  });

  it('marks the winner without a score when no cups were recorded', () => {
    render(<MatchCard slot={slot({ status: 'finished', winner_team_id: 'a' })} teamsMap={teamsMap} />);
    expect(screen.getByText('Alpha').className).toContain('font-semibold');
    expect(screen.getByText('Alpha').parentElement).toHaveTextContent(/^Alpha$/);
  });

  it('describes the whole match for screen readers', () => {
    render(<MatchCard slot={slot({ status: 'finished', winner_team_id: 'a', score_a: 2, score_b: 0 })} teamsMap={teamsMap} />);
    expect(
      screen.getByRole('article', { name: 'Spiel 7, Alpha (rot) gegen Bravo (blau), beendet, Sieger Alpha, Ergebnis 2:0' }),
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
    expect(screen.getByRole('article').className).toContain('border-primary/50');

    rerender(<MatchCard slot={slot({ status: 'finished', winner_team_id: 'a' })} teamsMap={teamsMap} />);
    expect(screen.getByRole('article').className).not.toContain('border-primary/50');
  });

  it('becomes a button with a handler', () => {
    const onClick = vi.fn();
    render(<MatchCard slot={slot()} teamsMap={teamsMap} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: /Spiel 7/ }));
    expect(onClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'm' }));
  });
});
