export type SupabaseEnv = {
  url: string
  anonKey: string
  isConfigured: boolean
}

export function getSupabaseEnv(): SupabaseEnv {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? ''
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? ''

  return {
    url,
    anonKey,
    isConfigured: url.length > 0 && anonKey.length > 0,
  }
}

export function getSupabaseConfigMessage(): string | null {
  if (getSupabaseEnv().isConfigured) {
    return null
  }

  return 'Supabase não configurado. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no ambiente.'
}

export function assertSupabaseEnv(): { url: string; anonKey: string } {
  const env = getSupabaseEnv()

  if (!env.isConfigured) {
    throw new Error(
      'Supabase não configurado. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.',
    )
  }

  return { url: env.url, anonKey: env.anonKey }
}
