import { beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => vi.clearAllMocks())
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ConfirmProvider, useConfirm, type ConfirmOptions } from '../confirm-dialog'
import { ApiError } from '@/lib/api'
import { notifyError } from '@/lib/errors'

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast }))

function Ask({ options, onResult }: { options: ConfirmOptions; onResult: (ok: boolean) => void }) {
  const confirm = useConfirm()
  return <button onClick={async () => onResult(await confirm(options))}>Fragen</button>
}

const setup = (options: Partial<ConfirmOptions> = {}) => {
  const onResult = vi.fn()
  const action = options.action ?? vi.fn()
  render(
    <ConfirmProvider>
      <Ask
        options={{ title: 'Turnier starten?', description: 'Der Spielplan wird ausgelost.', confirmLabel: 'Turnier starten', ...options, action }}
        onResult={onResult}
      />
    </ConfirmProvider>,
  )
  fireEvent.click(screen.getByText('Fragen'))
  return { onResult, action }
}

describe('ConfirmProvider', () => {
  it('asks with title, consequences and a button with verb and object, then runs the action', async () => {
    const { onResult, action } = setup()
    expect(screen.getByText('Turnier starten?')).toBeInTheDocument()
    expect(screen.getByText('Der Spielplan wird ausgelost.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Turnier starten' }))
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(true))
    expect(action).toHaveBeenCalled()
  })

  it('does nothing when cancelled', async () => {
    const { onResult, action } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(false))
    expect(action).not.toHaveBeenCalled()
  })

  it('shows that it runs; a failure is a toast and the dialog stays open to try again', async () => {
    let fail!: (e: Error) => void
    setup({ action: () => new Promise<void>((_, reject) => (fail = reject)) })
    fireEvent.click(screen.getByRole('button', { name: 'Turnier starten' }))
    expect(await screen.findByRole('button', { name: 'Bitte warten…' })).toBeDisabled()

    fail(new ApiError(409, { detail: 'Zu wenige Teams.' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Zu wenige Teams.'))
    expect(screen.getByText('Turnier starten?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Turnier starten' })).toBeEnabled()
  })

  it('does not say an error twice that a mutation has reported already', async () => {
    const error = new ApiError(409, { detail: 'Schon gestartet.' })
    notifyError(error)
    setup({ action: () => Promise.reject(error) })
    fireEvent.click(screen.getByRole('button', { name: 'Turnier starten' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Turnier starten' })).toBeEnabled())
    expect(toast.error).toHaveBeenCalledTimes(1)
  })
})

describe('ConfirmProvider: type to confirm', () => {
  it('runs only after the text was typed, ignoring case and spaces at the ends', async () => {
    const { onResult, action } = setup({ typeToConfirm: 'Sommer Cup', confirmLabel: 'Turnier löschen', destructive: true })
    const button = screen.getByRole('button', { name: 'Turnier löschen' })
    expect(button).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/Zum Bestätigen/), { target: { value: 'Sommer' } })
    expect(button).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/Zum Bestätigen/), { target: { value: ' sommer cup ' } })
    expect(button).toBeEnabled()

    fireEvent.click(button)
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(true))
    expect(action).toHaveBeenCalled()
  })
})
