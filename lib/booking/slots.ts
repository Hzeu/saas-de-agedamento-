import { isValidYmd } from '@/lib/booking/date'

export type WorkingHourRow = {
  day_of_week: number
  start_time: string
  end_time: string
}

const DEFAULT_HOURS: WorkingHourRow[] = [
  { day_of_week: 1, start_time: '09:00', end_time: '18:00' },
  { day_of_week: 2, start_time: '09:00', end_time: '18:00' },
  { day_of_week: 3, start_time: '09:00', end_time: '18:00' },
  { day_of_week: 4, start_time: '09:00', end_time: '18:00' },
  { day_of_week: 5, start_time: '09:00', end_time: '18:00' },
  { day_of_week: 6, start_time: '09:00', end_time: '13:00' },
]

function padTime(hm: string): string {
  const [h, m = '0'] = hm.split(':')
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`
}

/** Dia da semana 0=domingo para YYYY-MM-DD (meio-dia no fuso BR). */
function weekdayForDayYmd(dayYmd: string): number {
  return new Date(`${dayYmd}T12:00:00-03:00`).getUTCDay()
}

/**
 * Gera horários ISO (UTC) em passos fixos, usando janela local BR (-03) no literal da data.
 */
export function buildHourlySlots(
  dayYmd: string,
  hours: WorkingHourRow[],
  occupiedUtcIso: string[],
  stepMinutes = 60,
): string[] {
  if (!isValidYmd(dayYmd)) return []

  const dow = weekdayForDayYmd(dayYmd)
  const rows = (hours?.length ? hours : DEFAULT_HOURS).filter((w) => w.day_of_week === dow)
  if (!rows.length) return []

  const occMin = new Set(occupiedUtcIso.map((t) => Math.floor(new Date(t).getTime() / 60000)))

  const slots: string[] = []
  for (const row of rows) {
    const start = new Date(`${dayYmd}T${padTime(row.start_time)}:00-03:00`)
    const end = new Date(`${dayYmd}T${padTime(row.end_time)}:00-03:00`)
    for (let t = start.getTime(); t < end.getTime(); t += stepMinutes * 60_000) {
      if (!occMin.has(Math.floor(t / 60000))) {
        slots.push(new Date(t).toISOString())
      }
    }
  }
  return [...new Set(slots)].sort()
}

export function formatSlotLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  })
}
