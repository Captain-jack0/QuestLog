import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.local ' +
      'in the repo root and fill it in (see README → Getting started).',
  )
}

/** Sessions are persisted in localStorage and auto-refreshed by supabase-js. */
export const supabase = createClient<Database>(url, anonKey)
