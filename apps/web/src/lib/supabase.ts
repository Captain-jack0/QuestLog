import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/**
 * Supabase client. Null until you copy .env.example to .env.local and fill in
 * your project's URL + anon key (task INF-02 wires auth and real data).
 */
export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null

export const supabaseConfigured = supabase !== null
