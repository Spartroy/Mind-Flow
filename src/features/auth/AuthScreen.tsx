import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase, supabaseConfigured } from '@/lib/supabase'

type Status = { kind: 'idle' } | { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'sent' }

export function AuthScreen() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const loading = status.kind === 'loading'

  async function run(action: () => Promise<{ error: { message: string } | null }>, onOk?: Status) {
    if (!supabaseConfigured) {
      setStatus({ kind: 'error', message: 'Supabase is not configured. Copy .env.example to .env.' })
      return
    }
    setStatus({ kind: 'loading' })
    try {
      const { error } = await action()
      setStatus(error ? { kind: 'error', message: error.message } : (onOk ?? { kind: 'idle' }))
    } catch {
      setStatus({ kind: 'error', message: t('auth.errors.generic') })
    }
  }

  function submit(e: FormEvent, mode: 'in' | 'up') {
    e.preventDefault()
    if (!email || !password) {
      setStatus({ kind: 'error', message: t('auth.errors.required') })
      return
    }
    void run(() =>
      mode === 'in'
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password }),
    )
  }

  function magic() {
    if (!email) {
      setStatus({ kind: 'error', message: t('auth.errors.required') })
      return
    }
    void run(() => supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } }), {
      kind: 'sent',
    })
  }

  return (
    <main className="grid min-h-screen place-items-center p-4">
      <form
        onSubmit={(e) => submit(e, 'in')}
        className="w-full max-w-sm space-y-4 rounded-card border-[1.5px] border-border bg-surface p-6"
        aria-busy={loading}
      >
        <h1 className="text-start text-xl font-semibold" dir="auto">
          {t('auth.title')}
        </h1>
        <label className="block space-y-1 text-sm">
          <span>{t('auth.email')}</span>
          <Input type="email" autoComplete="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="block space-y-1 text-sm">
          <span>{t('auth.password')}</span>
          <Input
            type="password"
            autoComplete="current-password"
            dir="ltr"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <div role="status" aria-live="polite" className="min-h-5 text-sm">
          {status.kind === 'error' && <span className="text-danger">{status.message}</span>}
          {status.kind === 'sent' && <span className="text-primary">{t('auth.magicSent')}</span>}
          {loading && <span className="text-muted">{t('auth.loading')}</span>}
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={loading} className="flex-1">
            {t('auth.signIn')}
          </Button>
          <Button variant="outline" disabled={loading} onClick={(e) => submit(e, 'up')} className="flex-1">
            {t('auth.signUp')}
          </Button>
        </div>
        <p className="text-center text-xs text-muted">{t('auth.orSeparator')}</p>
        <Button variant="ghost" disabled={loading} onClick={magic} className="w-full">
          {t('auth.magicLink')}
        </Button>
      </form>
    </main>
  )
}
