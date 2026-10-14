import { create } from 'zustand'
import i18n, { dirFor, type Locale } from '@/i18n'

export type ThemePref = 'system' | 'light' | 'dark'

const read = <T extends string>(key: string, fallback: T): T => {
  try {
    return (localStorage.getItem(key) as T | null) ?? fallback
  } catch {
    return fallback
  }
}
const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* storage unavailable */
  }
}

export const resolveTheme = (pref: ThemePref, systemDark: boolean): 'light' | 'dark' =>
  pref === 'system' ? (systemDark ? 'dark' : 'light') : pref

/** Apply theme class and dir/lang to <html>. */
export function applyToDocument(theme: ThemePref, locale: Locale, systemDark: boolean) {
  const root = document.documentElement
  root.classList.remove('light', 'dark')
  root.classList.add(resolveTheme(theme, systemDark))
  root.lang = locale
  root.dir = dirFor(locale)
}

interface PrefsState {
  theme: ThemePref
  locale: Locale
  setTheme: (t: ThemePref) => void
  setLocale: (l: Locale) => void
}

const systemDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches

export const usePrefs = create<PrefsState>((set, get) => ({
  theme: read<ThemePref>('nf-theme', 'system'),
  locale: read<Locale>('nf-locale', 'en'),
  setTheme: (theme) => {
    write('nf-theme', theme)
    set({ theme })
    applyToDocument(theme, get().locale, systemDark())
  },
  setLocale: (locale) => {
    write('nf-locale', locale)
    set({ locale })
    void i18n.changeLanguage(locale)
    applyToDocument(get().theme, locale, systemDark())
  },
}))

export function initPrefs() {
  const { theme, locale } = usePrefs.getState()
  void i18n.changeLanguage(locale)
  applyToDocument(theme, locale, systemDark())
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const s = usePrefs.getState()
    applyToDocument(s.theme, s.locale, systemDark())
  })
}
