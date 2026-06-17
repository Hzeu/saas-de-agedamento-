import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { assertSupabaseEnv, getSupabaseEnv } from '@/lib/supabase/env'

let browserClient: SupabaseClient | null = null

export function isSupabaseConfigured() {
  return getSupabaseEnv().isConfigured
}

export function createClient() {
  if (browserClient) {
    return browserClient
  }

  const { url, anonKey } = assertSupabaseEnv()
  browserClient = createBrowserClient(url, anonKey)
  return browserClient
}
