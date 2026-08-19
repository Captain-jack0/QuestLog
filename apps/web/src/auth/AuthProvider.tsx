import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Navigate, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

interface AuthState {
  session: Session | null
  /** True until the persisted session has been read back from storage. */
  loading: boolean
}

const AuthContext = createContext<AuthState>({ session: null, loading: true })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, loading: true })
  const queryClient = useQueryClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setState({ session: data.session, loading: false })
    })
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setState({ session, loading: false })
      // Never let one account's cached rows show up under another, and refetch anything
      // that was fired while the access token was still being attached.
      if (event === 'SIGNED_OUT') queryClient.clear()
      if (event === 'SIGNED_IN') queryClient.invalidateQueries()
    })
    return () => data.subscription.unsubscribe()
  }, [queryClient])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  return useContext(AuthContext)
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) return <p className="p-8 text-center text-muted">Loading…</p>
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <>{children}</>
}
