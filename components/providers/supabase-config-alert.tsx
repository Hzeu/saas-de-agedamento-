'use client'

import { AlertTriangle } from 'lucide-react'
import { getSupabaseEnv } from '@/lib/supabase/env'

export function SupabaseConfigAlert() {
  const { isConfigured } = getSupabaseEnv()

  if (isConfigured) {
    return null
  }

  return (
    <div
      role="alert"
      className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100"
    >
      <div className="mx-auto flex max-w-7xl items-start gap-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <div>
          <p className="font-medium">Configuração do Supabase incompleta</p>
          <p className="mt-1 text-amber-900/80 dark:text-amber-100/80">
            Defina as variáveis{' '}
            <code className="rounded bg-amber-500/15 px-1 py-0.5 text-xs">
              NEXT_PUBLIC_SUPABASE_URL
            </code>{' '}
            e{' '}
            <code className="rounded bg-amber-500/15 px-1 py-0.5 text-xs">
              NEXT_PUBLIC_SUPABASE_ANON_KEY
            </code>{' '}
            no arquivo <code className="rounded bg-amber-500/15 px-1 py-0.5 text-xs">.env.local</code>{' '}
            ou no painel da Vercel. Login, cadastro e dashboard ficam indisponíveis até a configuração
            ser concluída.
          </p>
        </div>
      </div>
    </div>
  )
}
