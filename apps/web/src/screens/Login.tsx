import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Navigate, useLocation } from 'react-router-dom'
import { z } from 'zod'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { fieldClass } from '../components/ui/field'
import { Button } from '../components/ui/Button'
import { LogoMark } from '../components/Logo'

type Mode = 'signin' | 'signup' | 'magic'

// The password field is unmounted in magic-link mode; shouldUnregister drops it from the
// payload there, so `optional()` covers exactly that case.
const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'At least 8 characters').optional(),
})

type FormValues = z.infer<typeof schema>

const labels: Record<Mode, string> = {
  signin: 'Sign in',
  signup: 'Create account',
  magic: 'Send magic link',
}

export function LoginScreen() {
  const { session, loading } = useAuth()
  const location = useLocation()
  // The landing page's "Start free" button asks for the signup form directly.
  const requestedMode = (location.state as { mode?: Mode } | null)?.mode
  const [mode, setMode] = useState<Mode>(requestedMode === 'signup' ? 'signup' : 'signin')
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), shouldUnregister: true })

  if (loading) return <p className="p-8 text-center text-muted">Loading…</p>
  if (session) return <Navigate to={(location.state as { from?: string })?.from ?? '/'} replace />

  async function onSubmit(values: FormValues) {
    setNotice(null)
    setError(null)
    const redirectTo = window.location.origin

    if (mode !== 'magic' && !values.password) {
      setError('Password is required')
      return
    }

    const { error: authError } =
      mode === 'signin'
        ? await supabase.auth.signInWithPassword({
            email: values.email,
            password: values.password!,
          })
        : mode === 'signup'
          ? await supabase.auth.signUp({
              email: values.email,
              password: values.password!,
              options: { emailRedirectTo: redirectTo },
            })
          : await supabase.auth.signInWithOtp({
              email: values.email,
              options: { emailRedirectTo: redirectTo },
            })

    if (authError) {
      setError(authError.message)
      return
    }
    // signin flips the session via onAuthStateChange; the other two need the inbox.
    if (mode === 'signup') setNotice('Check your inbox to confirm your address.')
    if (mode === 'magic') setNotice('Magic link sent — check your inbox.')
  }

  function switchTo(next: Mode) {
    setMode(next)
    setError(null)
    setNotice(null)
    // The control that was just pressed may have turned into plain text; keep keyboard focus
    // in the form instead of letting it fall to <body> (WCAG 2.4.3).
    setFocus('email')
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10 sm:px-6">
      <div className="rounded-card border border-line bg-surface-raised p-6 shadow-float sm:p-8">
        <div className="text-center">
          {/* The h1 below already says "QuestLog"; the mark is decoration here. */}
          <span aria-hidden>
            <LogoMark className="mx-auto h-12 w-12" />
          </span>
          <h1 className="mt-4 text-title-lg">QuestLog</h1>
          <p className="mt-1 text-lead text-muted">Never lose the thread again.</p>
        </div>

        {/* Sign in | Create account. The current mode is plain text, not a button: e2e presses
            the one button named "Create account" to switch, then the same name again to submit,
            so only one control may carry that name at a time. Magic link is reached from the
            link under the form; in that mode both halves are buttons and neither is current. */}
        <div
          role="group"
          aria-label="Account"
          className="mt-6 grid grid-cols-2 gap-1 rounded-xl border border-line bg-surface-sunken p-1"
        >
          {(['signin', 'signup'] as const).map((m) =>
            m === mode ? (
              <span
                key={m}
                aria-current="true"
                className="flex min-h-[44px] items-center justify-center rounded-lg border border-line bg-surface-raised text-body-medium font-semibold text-ink"
              >
                {labels[m]}
              </span>
            ) : (
              <button
                key={m}
                type="button"
                onClick={() => switchTo(m)}
                className="link-quiet flex min-h-[44px] items-center justify-center rounded-lg border border-transparent text-body-medium text-muted transition"
              >
                {labels[m]}
              </button>
            ),
          )}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-micro uppercase text-muted">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              {...register('email')}
              className={fieldClass}
            />
            {errors.email && (
              <p className="mt-1 text-body text-alert-ink">{errors.email.message}</p>
            )}
          </div>

          {mode !== 'magic' && (
            <div>
              <label htmlFor="password" className="mb-1.5 block text-micro uppercase text-muted">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                {...register('password')}
                className={fieldClass}
              />
              {errors.password && (
                <p className="mt-1 text-body text-alert-ink">{errors.password.message}</p>
              )}
            </div>
          )}

          {error && (
            <p role="alert" className="text-body text-alert-ink">
              {error}
            </p>
          )}
          {/* Always mounted so screen readers register the live region before the text lands;
              sr-only (out of flow) while empty, so it doesn't add a space-y gap of its own. */}
          <p role="status" className={notice ? 'text-body text-success-ink' : 'sr-only'}>
            {notice}
          </p>

          <Button type="submit" disabled={isSubmitting} block>
            {isSubmitting ? 'Working…' : labels[mode]}
          </Button>
        </form>

        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => switchTo(mode === 'magic' ? 'signin' : 'magic')}
            className="link-quiet min-h-[44px] rounded-lg px-3 text-body-medium text-accent-ink transition"
          >
            {mode === 'magic' ? 'Use a password instead' : 'Email me a magic link instead'}
          </button>
        </div>
      </div>
    </div>
  )
}
