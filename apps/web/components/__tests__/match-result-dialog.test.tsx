import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MatchResultDialog } from '../match-result-dialog';
import { api } from '@/lib/api';
import { ResultType } from '@/types';
import type { Match, Result } from '@/types';
import { makeMatch } from '@/lib/test-fixtures/bracket';

vi.mock('@/lib/api', () => ({
  api: {
    results: { list: vi.fn(), create: vi.fn(), modify: vi.fn(), delete: vi.fn() },
    matches: { start: vi.fn(), undoStart: vi.fn() },
  },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

const results = vi.mocked(api.results);
const teamA = { id: 'a', name: 'Alpha' };
const teamB = { id: 'b', name: 'Bravo' };

const match = (overrides: Partial<Match> = {}): Match =>
  makeMatch({ id: 'm1', round: 1, position: 0, team_a_id: 'a', team_b_id: 'b', status: 'queued', ...overrides });

const result = (overrides: Partial<Result> = {}): Result => ({
  id: 'r1',
  match_id: 'm1',
  type: ResultType.CREATED,
  winner_team_id: 'a',
  cups_left: 4,
  reported_by_user_id: 'u1',
  reported_by_username: 'Ref',
  created_at: '2026-01-02T10:00:00Z',
  ...overrides,
});

function setup(props: Partial<React.ComponentProps<typeof MatchResultDialog>> = {}) {
  const onOpenChange = vi.fn();
  const onSuccess = vi.fn();
  const view = render(
    <MatchResultDialog
      match={match()}
      teamA={teamA}
      teamB={teamB}
      open
      onOpenChange={onOpenChange}
      onSuccess={onSuccess}
      {...props}
    />,
  );
  return { onOpenChange, onSuccess, ...view };
}

const ready = () => screen.findByText('Wer hat gewonnen?');
const cupsInput = () => screen.getByPlaceholderText('10') as HTMLInputElement;
const saveButton = () => screen.getByRole('button', { name: /Ergebnis speichern|Ergebnis ändern|Wird gespeichert/ });
/** Deleting asks first: the link opens the confirmation with the consequence, its button deletes. */
const confirmDelete = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Ergebnis löschen' }));
  fireEvent.click(screen.getAllByRole('button', { name: 'Ergebnis löschen' }).at(-1)!);
};

describe('MatchResultDialog', () => {
  beforeEach(() => {
    Object.values(results).forEach((fn) => fn.mockReset());
    results.list.mockResolvedValue([]);
  });

  it('renders nothing while closed', () => {
    setup({ open: false });
    expect(screen.queryByText('Ergebnis eintragen')).not.toBeInTheDocument();
    expect(results.list).not.toHaveBeenCalled();
  });

  it('shows a spinner while the previous results load', async () => {
    let resolve!: (r: Result[]) => void;
    results.list.mockReturnValue(new Promise((r) => (resolve = r)));
    const { container } = setup();

    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    resolve([]);
    await ready();
    expect(container.querySelector('.animate-spin')).not.toBeInTheDocument();
  });

  it('creates a result for team A', async () => {
    results.create.mockResolvedValue(result());
    const { onSuccess, onOpenChange } = setup();
    await ready();

    expect(saveButton()).toBeDisabled(); // no winner yet
    fireEvent.click(screen.getAllByText('Alpha')[1].closest('button')!);
    expect(cupsInput()).toHaveFocus(); // straight into the cups of the winner
    expect(saveButton()).toBeEnabled(); // the cups are optional

    fireEvent.change(cupsInput(), { target: { value: '4' } });
    expect(saveButton()).toBeEnabled();
    fireEvent.click(saveButton());

    await waitFor(() => expect(results.create).toHaveBeenCalledWith('m1', 'a', 4));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('saves the placeholder: without an entry the winner had all 10 cups left', async () => {
    results.create.mockResolvedValue(result());
    setup();
    await ready();
    fireEvent.click(screen.getAllByText('Bravo')[1].closest('button')!);
    fireEvent.click(saveButton());
    await waitFor(() => expect(results.create).toHaveBeenCalledWith('m1', 'b', 10));
  });

  it('does not jump into the cups when an existing result is opened', async () => {
    results.list.mockResolvedValue([result()]);
    setup();
    await ready();
    expect(cupsInput()).not.toHaveFocus();
  });

  it('creates a result for team B and ignores out-of-range cups', async () => {
    results.create.mockResolvedValue(result());
    setup();
    await ready();

    fireEvent.click(screen.getAllByText('Bravo')[1].closest('button')!);
    fireEvent.change(cupsInput(), { target: { value: '11' } });
    expect(cupsInput().value).toBe('');
    fireEvent.change(cupsInput(), { target: { value: '0' } });
    expect(cupsInput().value).toBe('');
    fireEvent.change(cupsInput(), { target: { value: '7' } });
    fireEvent.change(cupsInput(), { target: { value: '' } });
    fireEvent.change(cupsInput(), { target: { value: '10' } });
    fireEvent.click(saveButton());

    await waitFor(() => expect(results.create).toHaveBeenCalledWith('m1', 'b', 10));
  });

  it('keeps clicks inside the cups input from toggling the card', async () => {
    setup();
    await ready();
    fireEvent.click(screen.getAllByText('Alpha')[1].closest('button')!);

    fireEvent.click(cupsInput());
    fireEvent.keyDown(cupsInput(), { key: 'a' });
    expect(cupsInput()).toBeInTheDocument();

    fireEvent.click(screen.getAllByText('Bravo')[1].closest('button')!);
    fireEvent.click(cupsInput());
    fireEvent.keyDown(cupsInput(), { key: 'a' });
    expect(cupsInput()).toBeInTheDocument();
  });

  it('shows a saving state and surfaces errors from the API', async () => {
    let reject!: (e: unknown) => void;
    results.create.mockReturnValue(new Promise((_, r) => (reject = r)));
    const { onSuccess } = setup();
    await ready();
    fireEvent.click(screen.getAllByText('Alpha')[1].closest('button')!);
    fireEvent.change(cupsInput(), { target: { value: '3' } });
    fireEvent.click(saveButton());

    expect(await screen.findByText('Wird gespeichert...')).toBeDisabled();
    reject(new Error('Spiel gesperrt'));
    expect(await screen.findByText('Spiel gesperrt')).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('uses a generic message for non-Error failures', async () => {
    results.create.mockRejectedValue('nope');
    setup();
    await ready();
    fireEvent.click(screen.getAllByText('Alpha')[1].closest('button')!);
    fireEvent.change(cupsInput(), { target: { value: '3' } });
    fireEvent.click(saveButton());
    expect(await screen.findByText('Fehler beim Melden des Ergebnisses')).toBeInTheDocument();
  });

  it('prefills an existing result and only allows saving changes', async () => {
    results.list.mockResolvedValue([result()]);
    results.modify.mockResolvedValue(result());
    const { onSuccess } = setup();
    await ready();

    expect(cupsInput().value).toBe('4');
    expect(saveButton()).toHaveTextContent('Ergebnis ändern');
    expect(saveButton()).toBeDisabled();

    fireEvent.change(cupsInput(), { target: { value: '6' } });
    fireEvent.click(saveButton());
    await waitFor(() => expect(results.modify).toHaveBeenCalledWith('m1', 'a', 6));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
  });

  it('treats a switched winner as a change', async () => {
    results.list.mockResolvedValue([result({ cups_left: null })]);
    setup();
    await ready();

    expect(cupsInput().value).toBe('');
    fireEvent.click(screen.getAllByText('Bravo')[1].closest('button')!);
    fireEvent.change(cupsInput(), { target: { value: '2' } });
    expect(saveButton()).toBeEnabled();
  });

  it('does not prefill when the latest entry is a deletion', async () => {
    results.list.mockResolvedValue([result(), result({ id: 'r2', type: ResultType.DELETED })]);
    setup();
    await ready();
    expect(screen.queryByText('Ergebnis ändern')).not.toBeInTheDocument();
    expect(screen.queryByText('Ergebnis löschen')).not.toBeInTheDocument();
  });

  it('deletes an existing result', async () => {
    results.list.mockResolvedValue([result()]);
    results.delete.mockResolvedValue(result());
    const { onSuccess, onOpenChange } = setup();
    await ready();

    fireEvent.click(screen.getByRole('button', { name: 'Ergebnis löschen' }));
    expect(results.delete).not.toHaveBeenCalled(); // asks first and names the consequence
    expect(screen.getByText('Das Finale ist wieder offen, das Turnier gilt nicht mehr als beendet.')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Ergebnis löschen' }).at(-1)!);
    await waitFor(() => expect(results.delete).toHaveBeenCalledWith('m1'));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('names who leaves the next match when a result is deleted', async () => {
    results.list.mockImplementation(async (id: string) => (id === 'm1' ? [result()] : []));
    setup({ match: match({ next_match_id: 'next' }) });
    await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Ergebnis löschen' }));
    expect(screen.getByText('Alpha wird aus dem nächsten Spiel wieder entfernt, das Spiel ist wieder offen.')).toBeInTheDocument();
  });

  it('shows delete errors', async () => {
    results.list.mockResolvedValue([result()]);
    results.delete.mockRejectedValueOnce(new Error('Löschen verboten'));
    setup();
    await ready();
    confirmDelete();
    expect(await screen.findByText('Löschen verboten')).toBeInTheDocument();

    results.delete.mockRejectedValueOnce('x');
    fireEvent.click(screen.getAllByRole('button', { name: 'Ergebnis löschen' }).at(-1)!);
    expect(await screen.findByText('Fehler beim Löschen des Ergebnisses')).toBeInTheDocument();
  });

  it('shows the label while deleting', async () => {
    results.list.mockResolvedValue([result()]);
    results.delete.mockReturnValue(new Promise(() => {}));
    setup();
    await ready();
    confirmDelete();
    expect(await screen.findByText('Wird gelöscht...')).toBeDisabled();
  });

  it('toggles and renders the history of all entries', async () => {
    results.list.mockResolvedValue([
      result({ id: '1', type: ResultType.CREATED, winner_team_id: 'a', cups_left: 4 }),
      result({ id: '2', type: ResultType.MODIFIED, winner_team_id: 'b', cups_left: null, reported_by_username: undefined }),
      result({ id: '3', type: ResultType.MODIFIED, winner_team_id: 'zzz', cups_left: null }),
      result({ id: '4', type: ResultType.DELETED, winner_team_id: null }),
    ]);
    setup();
    await ready();

    expect(screen.queryByText(/Gemeldet/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Verlauf anzeigen'));

    expect(screen.getByText(/Gemeldet: Alpha \(4 Becher\)/)).toBeInTheDocument();
    expect(screen.getByText(/Geändert: Bravo/)).toBeInTheDocument();
    expect(screen.getByText(/Geändert: Unbekannt/)).toBeInTheDocument();
    expect(screen.getByText('Ergebnis gelöscht')).toBeInTheDocument();
    expect(screen.getByText('Unbekannt')).toBeInTheDocument(); // missing reporter name

    fireEvent.click(screen.getByText('Verlauf ausblenden'));
    expect(screen.queryByText(/Gemeldet/)).not.toBeInTheDocument();
  });

  it('locks editing when the follow-up match already has a result', async () => {
    results.list.mockImplementation(async (id: string) => (id === 'next' ? [result({ id: 'n' })] : [result()]));
    setup({ match: match({ next_match_id: 'next' }) });
    await ready();

    expect(screen.getByText('Bearbeiten gesperrt')).toBeInTheDocument();
    expect(screen.getAllByText('Alpha')[1].closest('button')).toBeDisabled();
    expect(saveButton()).toBeDisabled();
    expect(screen.queryByText('Ergebnis löschen')).not.toBeInTheDocument(); // nothing to delete while locked
    fireEvent.click(screen.getAllByText('Bravo')[1].closest('button')!);
  });

  it.each([
    ['has only deleted results', [result({ type: ResultType.DELETED })]],
    ['has no results', []],
  ])('does not lock when the follow-up match %s', async (_name, nextResults) => {
    results.list.mockImplementation(async (id: string) => (id === 'next' ? nextResults : [result()]));
    setup({ match: match({ next_match_id: 'next' }) });
    await ready();
    expect(screen.queryByText('Bearbeiten gesperrt')).not.toBeInTheDocument();
  });

  it('survives a failing load', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    results.list.mockRejectedValue(new Error('offline'));
    setup();
    await ready();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('cancels', async () => {
    const { onOpenChange } = setup();
    await ready();
    fireEvent.click(screen.getByText('Abbrechen'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('does not submit without a winner', async () => {
    setup();
    await ready();
    fireEvent.click(saveButton());
    expect(results.create).not.toHaveBeenCalled();
  });
});

describe('MatchResultDialog: start', () => {
  beforeEach(() => {
    vi.mocked(api.results.list).mockResolvedValue([]);
    vi.mocked(api.matches.start).mockReset().mockResolvedValue(undefined);
    vi.mocked(api.matches.undoStart).mockReset().mockResolvedValue(undefined);
  });

  it('starts a match at its table and shows the table', async () => {
    const { onSuccess, onOpenChange } = setup({ match: match({ status: 'ready', table_id: 't', table_name: 'Terrasse' }) });
    await ready();

    expect(screen.getByText('Terrasse')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Spiel starten' }));

    await waitFor(() => expect(api.matches.start).toHaveBeenCalledWith('m1'));
    expect(onSuccess).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('cannot start a match without a table, but the result can still be reported', async () => {
    setup({ match: match({ status: 'queued', queue_position: 2 }) });
    await ready();

    expect(screen.queryByRole('button', { name: 'Spiel starten' })).not.toBeInTheDocument();
    expect(screen.getByText('Platz 2')).toBeInTheDocument();
    expect(saveButton()).toBeInTheDocument();
  });

  it('shows since when a live match runs and can take the start back', async () => {
    setup({ match: match({ status: 'live', table_id: 't', table_name: 'Tisch 1', started_at: '2026-10-16T18:05:00Z' }) });
    await ready();

    expect(screen.getByText(/^seit \d{2}:\d{2} Uhr$/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Start zurücknehmen' }));
    await waitFor(() => expect(api.matches.undoStart).toHaveBeenCalledWith('m1'));
  });
});
