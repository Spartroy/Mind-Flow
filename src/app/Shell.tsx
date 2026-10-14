import { useTranslation } from 'react-i18next'
import { Board } from '@/features/board/Board'
import { CardPanel } from '@/features/card/CardPanel'
import { BlitzPage } from '@/features/blitz/BlitzPage'
import { useClockSync } from '@/features/timer/useClockSync'
import { FinishHost } from '@/features/timer/FinishDialog'
import { FloatHost } from '@/features/timer/FloatHost'
import { TimerDock } from '@/features/timer/TimerDock'
import { MindMapPage } from '@/features/mindmap/MindMapPage'
import { TodayPage } from '@/features/today/TodayPage'
import { parseHash, useHash } from '@/lib/router'
import { ComingSoon } from './ComingSoon'
import { MobileNav, Sidebar } from './Sidebar'

export function Shell() {
  const { t } = useTranslation()
  const route = parseHash(useHash())
  useClockSync()
  const hosts = (
    <>
      <FloatHost />
      <FinishHost />
    </>
  )
  if (route.name === 'blitz') {
    return (
      <>
        <BlitzPage cardId={route.id} />
        {hosts}
      </>
    )
  }
  return (
    <div className="flex h-screen flex-col md:flex-row">
      <MobileNav route={route} />
      <Sidebar route={route} />
      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        {route.name === 'card' && route.page ? (
          <CardPanel id={route.id} page />
        ) : route.name === 'board' || route.name === 'card' ? (
          <>
            <Board />
            {route.name === 'card' && <CardPanel id={route.id} page={false} />}
          </>
        ) : route.name === 'today' ? (
          <TodayPage />
        ) : route.name === 'map' ? (
          <MindMapPage />
        ) : (
          <ComingSoon name={t(`nav.${route.name}`)} />
        )}
        <TimerDock />
      </main>
      {hosts}
    </div>
  )
}
