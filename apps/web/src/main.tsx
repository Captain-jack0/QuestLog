import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ErrorBoundary } from '@sentry/react'
import { AuthProvider } from './auth/AuthProvider'
import { ToastProvider } from './components/ui/Toast'
import { initSentry } from './lib/sentry'
import { applyTheme, storedTheme } from './lib/theme'
import App from './App'
import '@fontsource/inter/400.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/instrument-serif/400.css'
import 'primeicons/primeicons.css'
import './index.css'

initSentry()
// Paint before the first render so there is no flash of the other theme.
applyTheme(storedTheme())

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false },
  },
})

function Crashed() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 text-center">
      <h1 className="text-2xl font-bold">Something broke 🧭</h1>
      <p className="mt-2 text-muted">
        The error was reported. Reloading usually gets you back on track.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-6 min-h-[44px] rounded-xl bg-accent py-3 font-semibold text-white"
      >
        Reload
      </button>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary fallback={<Crashed />}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
