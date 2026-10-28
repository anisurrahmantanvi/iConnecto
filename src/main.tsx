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

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Missing #root element in index.html')

createRoot(rootEl).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <I18nProvider>
          <ToastProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </ToastProvider>
        </I18nProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
)

registerServiceWorker()
