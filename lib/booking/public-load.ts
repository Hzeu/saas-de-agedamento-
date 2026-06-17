import { buildHourlySlots, type WorkingHourRow } from '@/lib/booking/slots'
import { isValidYmd } from '@/lib/booking/date'
import { createPublicClient } from '@/lib/supabase/public'

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
  professionalId: string,
): Promise<PublicServiceOption[]> {
  const supabase = createPublicClient()
  const { data, error } = await supabase.rpc('get_booking_services', { p_id: professionalId })

  if (error) {
    console.error('[public-load] get_booking_services failed', {
      professionalId,
      message: error.message,
      code: error.code,
    })
    return []
  }

  if (!Array.isArray(data) || data.length === 0) {
    return []
  }

  return (data as PublicServiceRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    label: serviceLabel(row),
    price: row.price,
    duration_minutes: row.duration_minutes,
  }))
}

export async function loadPublicBookingProfile(slug: string): Promise<{
  error?: 'Perfil não encontrado.'
  data?: { id: string; full_name: string; slug: string }
}> {
  const supabase = createPublicClient()
  const normalizedSlug = slug.trim().toLowerCase()

  const { data: profRows, error } = await supabase.rpc('get_booking_profile', {
    p_slug: normalizedSlug,
  })

  if (error) {
    console.error('[public-load] get_booking_profile failed', {
      slug: normalizedSlug,
      message: error.message,
      code: error.code,
    })
    return { error: 'Perfil não encontrado.' }
  }

  if (!profRows?.length) {
    return { error: 'Perfil não encontrado.' }
  }

  return {
    data: profRows[0] as { id: string; full_name: string; slug: string },
  }
}

export async function loadPublicAvailability(
  slug: string,
  dayYmd: string,
): Promise<{ error?: string; data?: AvailabilityResult }> {
  const profileResult = await loadPublicBookingProfile(slug)

  if (profileResult.error || !profileResult.data) {
    return { error: profileResult.error ?? 'Perfil não encontrado.' }
  }

  const prof = profileResult.data
  const supabase = createPublicClient()
  const dayKey = isValidYmd(dayYmd) ? dayYmd : dayYmd.trim()

  const services = await loadPublicServices(prof.id)

  const { data: wh, error: whError } = await supabase.rpc('get_working_hours_for_professional', {
    p_id: prof.id,
  })
  if (whError) {
    console.error('[public-load] get_working_hours_for_professional failed', {
      professionalId: prof.id,
      message: whError.message,
      code: whError.code,
    })
  }

  const { data: occ, error: occError } = await supabase.rpc('get_booking_occupied_times', {
    p_id: prof.id,
    p_day: dayKey,
  })
  if (occError) {
    console.error('[public-load] get_booking_occupied_times failed', {
      professionalId: prof.id,
      message: occError.message,
      code: occError.code,
    })
  }

  const occupied = ((occ ?? []) as unknown[]).map((t) =>
    typeof t === 'string' ? t : new Date(t as string | number | Date).toISOString(),
  )

  const hours = (wh ?? []) as WorkingHourRow[]
  const slots = buildHourlySlots(dayKey, hours, occupied)

  return {
    data: {
      profile: {
        id: prof.id,
        full_name: prof.full_name,
        slug: prof.slug,
        services,
      },
      slots,
    },
  }
}
