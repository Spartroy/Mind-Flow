import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { PrefsBar } from '@/components/PrefsBar'
import { Shell } from '@/app/Shell'
import { AuthScreen } from '@/features/auth/AuthScreen'
import { isDemo } from '@/features/board/repo'
import { SpikePage } from '@/features/editor/SpikePage'
import { PipSpikePage } from '@/features/timer/PipSpikePage'
import { supabase } from '@/lib/supabase'

export default function App() {
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
  if (import.meta.env.DEV && location.hash === '#/spike-pip') return <PipSpikePage />
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
  return <Shell />
}
