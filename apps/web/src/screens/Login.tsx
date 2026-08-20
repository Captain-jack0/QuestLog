import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Navigate, useLocation } from 'react-router-dom'
import { z } from 'zod'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'

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
  const [mode, setMode] = useState<Mode>('signin')
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
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

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <div className="mb-8 text-center">
        <span aria-hidden className="text-5xl">
          🧭
        </span>
        <h1 className="mt-2 text-3xl font-bold">QuestLog</h1>
        <p className="mt-1 text-muted">
          Never lose the thread again. Log the quest, keep the streak.
        </p>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="space-y-3 rounded-card bg-surface p-5 shadow-quest"
      >
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            {...register('email')}
            className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-base outline-none focus:border-accent"
          />
          {errors.email && <p className="mt-1 text-sm text-flame-ink">{errors.email.message}</p>}
        </div>

        {mode !== 'magic' && (
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              {...register('password')}
              className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-base outline-none focus:border-accent"
            />
            {errors.password && (
              <p className="mt-1 text-sm text-flame-ink">{errors.password.message}</p>
            )}
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-flame-ink">
            {error}
          </p>
        )}
        {notice && <p className="text-sm text-success-ink">{notice}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="min-h-[44px] w-full rounded-xl bg-accent py-3 font-semibold text-white active:scale-[0.99] disabled:opacity-60"
        >
          {isSubmitting ? 'Working…' : labels[mode]}
        </button>
      </form>

      <div className="mt-6 flex flex-col items-center gap-2 text-sm text-muted">
        {(['signin', 'signup', 'magic'] as const)
          .filter((m) => m !== mode)
          .map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m)
                setError(null)
                setNotice(null)
              }}
              className="min-h-[44px] font-medium text-accent"
            >
              {labels[m]}
            </button>
          ))}
      </div>
    </div>
  )
}
