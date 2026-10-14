import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Session } from '@supabase/supabase-js'
import { PrefsBar } from '@/components/PrefsBar'
import { Button } from '@/components/ui/button'
import { AuthScreen } from '@/features/auth/AuthScreen'
import { supabase } from '@/lib/supabase'

export default function App() {
  const { t } = useTranslation()
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  return (
    <>
      <div className="absolute end-4 top-4">
        <PrefsBar />
      </div>
      {session ? (
        <main className="grid min-h-screen place-items-center p-4">
          <div className="space-y-4 text-center">
            <p dir="auto">{t('home.signedIn', { email: session.user.email })}</p>
            <p className="text-muted" dir="auto">
              {t('home.board')}
            </p>
            <Button variant="outline" onClick={() => void supabase.auth.signOut()}>
              {t('home.signOut')}
            </Button>
          </div>
        </main>
      ) : (
        <AuthScreen />
      )}
    </>
  )
}
