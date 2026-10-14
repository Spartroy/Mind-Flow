import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabaseConfigured = Boolean(url && key)

// Placeholder values keep the app renderable (the auth screen shows an error) when .env is missing.
export const supabase = createClient(url ?? 'http://127.0.0.1:54321', key ?? 'missing-anon-key')
