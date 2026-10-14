import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Session } from '@supabase/supabase-js'
import { PrefsBar } from '@/components/PrefsBar'
import { Button } from '@/components/ui/button'
import { AuthScreen } from '@/features/auth/AuthScreen'
import { Board } from '@/features/board/Board'
import { isDemo } from '@/features/board/repo'
import { SpikePage } from '@/features/editor/SpikePage'
import { supabase } from '@/lib/supabase'

export default function App() {
  const { t } = useTranslation()
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(isDemo)

  useEffect(() => {
    if (isDemo) return
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (import.meta.env.DEV && location.hash === '#/spike') return <SpikePage />
  if (!ready) return null
  if (!isDemo && !session) {
    return (
      <>
        <div className="absolute end-4 top-4">
          <PrefsBar />
        </div>
        <AuthScreen />
      </>
    )
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between gap-2 border-b-[1.5px] border-border px-4 py-3">
        <h1 className="text-lg font-bold text-primary">{t('app.name')}</h1>
        <div className="flex items-center gap-2">
          {isDemo && <span className="rounded-full bg-sun-soft px-2 py-0.5 text-xs">{t('home.demo')}</span>}
          <PrefsBar />
          {!isDemo && (
            <Button variant="outline" onClick={() => void supabase.auth.signOut()}>
              {t('home.signOut')}
            </Button>
          )}
        </div>
      </header>
      <Board />
    </div>
  )
}
