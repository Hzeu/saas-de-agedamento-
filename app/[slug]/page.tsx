import { notFound } from 'next/navigation'
import { RESERVED_PUBLIC_SLUGS } from '@/lib/constants'
import { loadPublicAvailability } from '@/lib/booking/public-load'
import { toYmdInTimeZone } from '@/lib/booking/date'
import { PublicBookingForm } from '@/components/public/public-booking-form'

export const dynamic = 'force-dynamic'

function todayYmd() {
  return toYmdInTimeZone()
}

export default async function PublicProfessionalPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug: raw } = await params
  const slug = raw.toLowerCase()

  if (RESERVED_PUBLIC_SLUGS.has(slug)) {
    notFound()
  }

  const day = todayYmd()
  const loaded = await loadPublicAvailability(slug, day)

  if (loaded.error === 'Perfil não encontrado.' || !loaded.data) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/40">
      <PublicBookingForm slug={slug} initialDay={day} initial={loaded.data} />
    </div>
  )
}
