import { sorted } from './logic'
import type { useBoardActions } from './hooks'

type Actions = ReturnType<typeof useBoardActions>

/**
 * Create a card in the first column (making starter columns first on an empty board).
 * Returns the new id immediately; `done` resolves once it is saved.
 */
export async function quickCreateCard(act: Actions, starterNames: string[], title: string, opts: { today?: boolean } = {}) {
  if (!act.snapshot()) throw new Error('Board is not loaded yet')
  if (!act.snapshot()!.columns.length) await act.addStarterColumns(starterNames)
  const first = sorted(act.snapshot()!.columns)[0]
  const { id, done } = act.addCard(title, first.id)
  const saved = done.then(() => (opts.today ? act.setToday(id, true) : undefined))
  return { id, done: saved }
}
