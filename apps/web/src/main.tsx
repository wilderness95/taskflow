import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './i18n'
import './shared/styles/tokens.css'
import './index.css'
import App from './app/App'
// Az általános reszponzív szabályok az összes komponens-CSS után jöjjenek (azonos fajsúlynál ez dönt).
import './shared/styles/responsive.css'
import { initTheme } from './shared/theme/useTheme'

initTheme()

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element (#root) not found')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
