import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './i18n'
import './shared/styles/tokens.css'
import './index.css'
import App from './app/App'
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
