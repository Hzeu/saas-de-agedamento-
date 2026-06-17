'use server'

import { revalidatePath } from 'next/cache'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { assertSupabaseEnv } from '@/lib/supabase/env'
import { buildHourlySlots, type WorkingHourRow } from '@/lib/booking/slots'
import type { BookingStatus } from '@/lib/types/database'

export type PublicBookingState = { error?: string; success?: boolean }

export type PublicServiceOption = {
  id: string
  name: string
  label: string
  price: number | null
  duration_minutes: number | null
}

export type AvailabilityResult = {
  profile: { id: string; full_name: string; slug: string; services: PublicServiceOption[] }
  slots: string[]
}

type PublicServiceRow = {
  id: string
  name: string
  price: number | null
  duration_minutes: number | null
}

function serviceLabel(service: PublicServiceRow): string {
  const price =
    typeof service.price === 'number'
      ? ` - ${service.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
      : ''
  const duration =
    typeof service.duration_minutes === 'number' ? ` (${service.duration_minutes} min)` : ''

  return `${service.name}${duration}${price}`
}

async function loadPublicServices(
  supabase: Awaited<ReturnType<typeof createClient>>,
  professionalId: string,
): Promise<{ services: PublicServiceOption[]; error?: string }> {
  const { data, error } = await supabase.rpc('get_booking_services', { p_id: professionalId })

  if (error) {
    console.error('[bookings] get_booking_services failed', {
      professionalId,
      message: error.message,
      code: error.code,
    })
    return {
      services: [],
      error: 'Não foi possível carregar os serviços deste profissional.',
    }
  }

  if (!Array.isArray(data) || data.length === 0) {
    return { services: [] }
  }

  return {
    services: (data as PublicServiceRow[]).map((row) => ({
      id: row.id,
      name: row.name,
      label: serviceLabel(row),
      price: row.price,
      duration_minutes: row.duration_minutes,
    })),
  }
}

export async function loadPublicAvailability(
  slug: string,
  dayYmd: string,
): Promise<{ error?: string; data?: AvailabilityResult }> {
  const supabase = await createClient()

  const { data: profRows, error: pe } = await supabase.rpc('get_booking_profile', { p_slug: slug.trim() })
  if (pe || !profRows?.length) {
    return { error: 'Perfil não encontrado.' }
  }

  const prof = profRows[0] as {
    id: string
    full_name: string
    slug: string
  }

  const { services, error: servicesError } = await loadPublicServices(supabase, prof.id)
  if (servicesError) {
    return { error: servicesError }
  }

  const { data: wh } = await supabase.rpc('get_working_hours_for_professional', { p_id: prof.id })
  const { data: occ } = await supabase.rpc('get_booking_occupied_times', {
    p_id: prof.id,
    p_day: dayYmd,
  })

  const occupied = ((occ ?? []) as unknown[]).map((t) =>
    typeof t === 'string' ? t : new Date(t as string | number | Date).toISOString(),
  )

  const hours = (wh ?? []) as WorkingHourRow[]
  const slots = buildHourlySlots(dayYmd, hours, occupied)

  return {
    data: {
      profile: { id: prof.id, full_name: prof.full_name, slug: prof.slug, services },
      slots,
    },
  }
}

export async function createPublicBooking(
  _prev: PublicBookingState | undefined,
  formData: FormData,
): Promise<PublicBookingState> {
  const slug = (formData.get('slug') as string)?.trim()
  const serviceId = (formData.get('serviceId') as string)?.trim()
  const clientName = (formData.get('clientName') as string)?.trim()
  const clientPhone = (formData.get('clientPhone') as string)?.trim()
  const slotIso = (formData.get('slotIso') as string)?.trim()

  if (!slug || !serviceId || !clientName || !clientPhone || !slotIso) {
    return { error: 'Preencha todos os campos.' }
  }

  const slotDate = new Date(slotIso)
  if (Number.isNaN(slotDate.getTime())) {
    return { error: 'Horário inválido.' }
  }

  const { url, anonKey } = assertSupabaseEnv()
  const publicSupabase = createSupabaseClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })

  const { error } = await publicSupabase.rpc('create_public_booking', {
    p_slug: slug,
    p_service_id: serviceId,
    p_client_name: clientName,
    p_client_phone: clientPhone,
    p_slot: slotDate.toISOString(),
  })

  if (error) {
    return { error: error.message || 'Não foi possível agendar.' }
  }

  return { success: true }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type ResolvedPublicBookingProfile = {
  slug: string
  professionalId: string
}

export async function resolvePublicBookingProfile(
  identifier: string,
): Promise<{ error?: string; profile?: ResolvedPublicBookingProfile }> {
  const supabase = await createClient()
  const normalized = identifier.trim()

  if (!normalized) return { error: 'Link inválido.' }

  const { data, error } = await supabase.rpc('get_booking_profile_by_identifier', {
    p_identifier: normalized.toLowerCase(),
  })

  if (!error && Array.isArray(data) && data.length > 0) {
    const row = data[0] as { id?: string; slug?: string | null }
    if (row.slug && row.id) {
      return { profile: { slug: row.slug, professionalId: row.id } }
    }
  }

  if (!normalized.includes('/')) {
    const slugCandidate = normalized.toLowerCase()
    const loaded = await loadPublicAvailability(slugCandidate, new Date().toISOString().slice(0, 10))
    if (loaded.data?.profile.slug) {
      return {
        profile: {
          slug: loaded.data.profile.slug,
          professionalId: loaded.data.profile.id,
        },
      }
    }
  }

  if (UUID_RE.test(normalized)) {
    return { error: 'Profissional não encontrado. Verifique o link de agendamento.' }
  }

  return { error: 'Profissional não encontrado.' }
}

/** @deprecated Use resolvePublicBookingProfile */
export async function resolvePublicBookingSlug(
  identifier: string,
): Promise<{ error?: string; slug?: string }> {
  const resolved = await resolvePublicBookingProfile(identifier)
  if (resolved.profile) return { slug: resolved.profile.slug }
  return { error: resolved.error }
}

export async function setBookingStatus(
  bookingId: string,
  status: BookingStatus,
): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  const { error } = await supabase
    .from('bookings')
    .update({ status })
    .eq('id', bookingId)
    .eq('professional_id', user.id)

  if (error) {
    return { error: error.message || 'Não foi possível atualizar.' }
  }

  revalidatePath('/dashboard/reservas')
  revalidatePath('/dashboard')
  return { success: true }
}
