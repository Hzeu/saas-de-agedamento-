import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { assertSupabaseEnv } from '@/lib/supabase/env'

/** Cliente anônimo para páginas públicas (sem cookies/sessão). */
export function createPublicClient() {
  const { url, anonKey } = assertSupabaseEnv()

  return createSupabaseClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}
