import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './styles/index.css'
import { App } from './app/App'
import { ErrorBoundary } from './app/ErrorBoundary'
import { ThemeProvider } from './app/ThemeProvider'
import { I18nProvider } from './lib/i18n'
import { ToastProvider } from './components/ui/Toast'
import { registerServiceWorker } from './lib/pwa'
import { ROUTER_BASENAME } from './lib/base'

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Missing #root element in index.html')

try { if (localStorage.getItem('iconnecto.allowCopy') === '1') document.documentElement.classList.add('allow-copy') } catch { /* ignore */ }

// Long-press on an in-app link/button should not open the browser's link menu/preview.
document.addEventListener('contextmenu', (e) => {
  const el = e.target as HTMLElement | null
  if (!el || el.closest('input, textarea, [contenteditable="true"]')) return
  if (el.closest('a, button, img, video')) e.preventDefault()
})

createRoot(rootEl).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <I18nProvider>
          <ToastProvider>
            <BrowserRouter basename={ROUTER_BASENAME}>
              <App />
            </BrowserRouter>
          </ToastProvider>
        </I18nProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
)

registerServiceWorker()
