import { useTranslation } from 'react-i18next'
import { Board } from '@/features/board/Board'
import { CardPanel } from '@/features/card/CardPanel'
import { parseHash, useHash } from '@/lib/router'
import { ComingSoon } from './ComingSoon'
import { Sidebar } from './Sidebar'

export function Shell() {
  const { t } = useTranslation()
  const route = parseHash(useHash())
  return (
    <div className="flex h-screen">
      <Sidebar route={route} />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {route.name === 'card' && route.page ? (
          <CardPanel id={route.id} page />
        ) : route.name === 'board' || route.name === 'card' ? (
          <>
            <Board />
            {route.name === 'card' && <CardPanel id={route.id} page={false} />}
          </>
        ) : (
          <ComingSoon name={t(`nav.${route.name}`)} />
        )}
      </main>
    </div>
  )
}
