import * as Sentry from '@sentry/react'

/**
 * Sentry is opt-in: it only starts when a DSN is configured and we are not in dev,
 * so local work never ships noise to the project.
 */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn || import.meta.env.DEV) return

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0,
  })
}
