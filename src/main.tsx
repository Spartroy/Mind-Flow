import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@fontsource/noto-sans-arabic/400.css'
import '@fontsource/noto-sans-arabic/600.css'
import './styles/index.css'
import './i18n'
import { initPrefs } from './lib/prefs'
import App from './App'

initPrefs()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
