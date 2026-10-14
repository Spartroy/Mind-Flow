import { useBoardActions } from '@/features/board/hooks'
import { useFinished } from './finishStore'

/** Finish the running session (server clock) and open the finish dialog with the final numbers. */
export function useFinishFlow() {
  const act = useBoardActions()
  const setFinished = useFinished((s) => s.set)
  return async () => {
    const row = await act.finishSession()
    if (row) setFinished(row)
  }
}
