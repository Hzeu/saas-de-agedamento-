'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createPublicClient } from '@/lib/supabase/public'
import { toYmdInTimeZone } from '@/lib/booking/date'
import type { BookingStatus } from '@/lib/types/database'

export type PublicBookingState = { error?: string; success?: boolean }

export async function loadPublicAvailability(slug: string, dayYmd: string) {
  const { loadPublicAvailability: loadPublicAvailabilityImpl } = await import('@/lib/booking/public-load')
  return loadPublicAvailabilityImpl(slug, dayYmd)
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

  const publicSupabase = createPublicClient()

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

  revalidatePath('/dashboard/reservas')
  revalidatePath('/dashboard/agenda')
  revalidatePath(`/${slug}`)

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
    const { loadPublicAvailability: loadPublicAvailabilityImpl } = await import('@/lib/booking/public-load')
    const loaded = await loadPublicAvailabilityImpl(slugCandidate, toYmdInTimeZone())
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

  const { data: profile } = await supabase.from('profiles').select('slug').eq('id', user.id).maybeSingle()

  revalidatePath('/dashboard/reservas')
  revalidatePath('/dashboard/agenda')
  revalidatePath('/dashboard')
  if (profile?.slug) {
    revalidatePath(`/${profile.slug}`)
  }

  return { success: true }
}
