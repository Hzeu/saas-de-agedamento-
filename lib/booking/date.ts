export const BOOKING_TIMEZONE = 'America/Sao_Paulo'

/** YYYY-MM-DD no fuso de agendamento (ISO 8601 date). */
export function toYmdInTimeZone(date: Date = new Date(), timeZone = BOOKING_TIMEZONE): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(date)
}

export function isValidYmd(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

/** HH:mm no fuso de agendamento a partir de ISO/timestamptz. */
export function timeFromIsoInZone(iso: string, timeZone = BOOKING_TIMEZONE): string {
  return new Date(iso).toLocaleTimeString('sv-SE', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export function addMinutesToHm(hm: string, minutes: number): string {
  const [h, m] = hm.split(':').map(Number)
  const total = h * 60 + m + minutes
  const nh = Math.floor(total / 60)
  const nm = total % 60
  return `${nh.toString().padStart(2, '0')}:${nm.toString().padStart(2, '0')}`
}
