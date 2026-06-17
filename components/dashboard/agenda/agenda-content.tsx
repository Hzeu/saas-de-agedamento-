'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { format, addDays, startOfWeek, isSameDay, isToday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatTime, getGenderAccentColors } from '@/lib/helpers'
import { addMinutesToHm, timeFromIsoInZone, toYmdInTimeZone } from '@/lib/booking/date'
import { APPOINTMENT_STATUS, DAYS_OF_WEEK } from '@/lib/constants'
import type { Appointment, BookingRow, Service, Client, WorkingHours } from '@/lib/types/database'
import { cn } from '@/lib/utils'
import { NewAppointmentDialog } from './new-appointment-dialog'

interface AgendaContentProps {
  professionalId: string
  services: Pick<Service, 'id' | 'name' | 'duration_minutes' | 'price'>[]
  clients: Pick<Client, 'id' | 'name' | 'phone'>[]
  workingHours: WorkingHours[]
}

type AgendaSlotItem = {
  id: string
  kind: 'appointment' | 'booking'
  clientName: string
  serviceName: string
  start_time: string
  end_time: string
  status: string
  price?: number
  gender?: string | null
}

export function AgendaContent({ 
  professionalId, 
  services, 
  clients,
  workingHours 
}: AgendaContentProps) {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [slotItems, setSlotItems] = useState<AgendaSlotItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    async function loadAgendaItems() {
      setIsLoading(true)
      const dateStr = format(selectedDate, 'yyyy-MM-dd')

      const appointmentsQuery = await supabase
        .from('appointments')
        .select(`
          *,
          client:clients(name, phone, gender),
          service:services(name, duration_minutes)
        `)
        .eq('professional_id', professionalId)
        .eq('appointment_date', dateStr)
        .order('start_time', { ascending: true })

      const appointmentsResult =
        appointmentsQuery.error &&
        appointmentsQuery.error.message.toLowerCase().includes('gender')
          ? await supabase
              .from('appointments')
              .select(`
                *,
                client:clients(name, phone),
                service:services(name, duration_minutes)
              `)
              .eq('professional_id', professionalId)
              .eq('appointment_date', dateStr)
              .order('start_time', { ascending: true })
          : appointmentsQuery

      const { data: bookings } = await supabase
        .from('bookings')
        .select('*')
        .eq('professional_id', professionalId)
        .neq('status', 'cancelled')
        .order('date', { ascending: true })

      const appointments = appointmentsResult.data

      const appointmentItems: AgendaSlotItem[] = (appointments ?? []).map((a: Appointment) => ({
        id: a.id,
        kind: 'appointment' as const,
        clientName: a.client?.name || 'Cliente',
        serviceName: a.service?.name || 'Serviço',
        start_time: a.start_time.slice(0, 5),
        end_time: a.end_time.slice(0, 5),
        status: a.status,
        price: a.price,
        gender: a.client?.gender ?? null,
      }))

      const bookingItems: AgendaSlotItem[] = (bookings ?? [])
        .filter((b: BookingRow) => toYmdInTimeZone(new Date(b.date)) === dateStr)
        .map((b: BookingRow) => {
          const start = timeFromIsoInZone(b.date)
          return {
            id: b.id,
            kind: 'booking' as const,
            clientName: b.client_name,
            serviceName: b.service,
            start_time: start,
            end_time: addMinutesToHm(start, 60),
            status: b.status,
            gender: null,
          }
        })

      setSlotItems(
        [...appointmentItems, ...bookingItems].sort((a, b) => a.start_time.localeCompare(b.start_time)),
      )
      setIsLoading(false)
    }

    loadAgendaItems()

    const onReload = () => setReloadKey((k) => k + 1)
    window.addEventListener('hydra:agenda-reload', onReload)
    return () => window.removeEventListener('hydra:agenda-reload', onReload)
  }, [selectedDate, professionalId, reloadKey, supabase])

  // Get week days
  const weekStart = startOfWeek(selectedDate, { locale: ptBR })
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  // Get working hours for the selected day
  const dayOfWeek = selectedDate.getDay()
  const todayWorkingHours = workingHours.find(wh => wh.day_of_week === dayOfWeek)

  // Generate time slots
  const timeSlots = []
  if (todayWorkingHours) {
    const [startH, startM] = todayWorkingHours.start_time.split(':').map(Number)
    const [endH, endM] = todayWorkingHours.end_time.split(':').map(Number)
    const startMinutes = startH * 60 + startM
    const endMinutes = endH * 60 + endM

    for (let m = startMinutes; m < endMinutes; m += 30) {
      const h = Math.floor(m / 60)
      const mins = m % 60
      timeSlots.push(`${h.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`)
    }
  }

  const getItemForSlot = (time: string) => {
    return slotItems.find((item) => {
      return time >= item.start_time && time < item.end_time
    })
  }

  return (
    <div className="space-y-6">
      {/* Date Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSelectedDate(d => addDays(d, -1))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="min-w-[200px]">
                <CalendarIcon className="mr-2 size-4" />
                {format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>

          <Button
            variant="outline"
            size="icon"
            onClick={() => setSelectedDate(d => addDays(d, 1))}
          >
            <ChevronRight className="size-4" />
          </Button>

          {!isToday(selectedDate) && (
            <Button variant="ghost" onClick={() => setSelectedDate(new Date())}>
              Hoje
            </Button>
          )}
        </div>

        <NewAppointmentDialog 
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          services={services}
          clients={clients}
          selectedDate={format(selectedDate, 'yyyy-MM-dd')}
          onCreated={() => setReloadKey((k) => k + 1)}
        />
      </div>

      {/* Week Days */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {weekDays.map((day) => {
          const isSelected = isSameDay(day, selectedDate)
          const dayInfo = DAYS_OF_WEEK[day.getDay()]
          
          return (
            <button
              key={day.toISOString()}
              onClick={() => setSelectedDate(day)}
              className={cn(
                'flex flex-col items-center justify-center min-w-[72px] h-20 rounded-xl border transition-colors',
                isSelected
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card border-border hover:border-primary/50',
                isToday(day) && !isSelected && 'border-primary'
              )}
            >
              <span className="text-xs font-medium opacity-70">{dayInfo.short}</span>
              <span className="text-2xl font-bold">{format(day, 'd')}</span>
            </button>
          )
        })}
      </div>

      {/* Day View */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">
            {todayWorkingHours ? (
              <>Horário: {formatTime(todayWorkingHours.start_time)} - {formatTime(todayWorkingHours.end_time)}</>
            ) : (
              'Dia não configurado para atendimento'
            )}
          </CardTitle>
          <Badge variant="secondary">
            {slotItems.filter((item) => item.status !== 'canceled' && item.status !== 'cancelled').length}{' '}
            agendamento(s)
          </Badge>
        </CardHeader>
        <CardContent>
          {!todayWorkingHours ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Você não configurou horário de atendimento para este dia.</p>
              <Button variant="link" asChild className="mt-2">
                <Link href="/dashboard/horarios">Configurar horários</Link>
              </Button>
            </div>
          ) : timeSlots.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nenhum horário disponível.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {timeSlots.map((time) => {
                const item = getItemForSlot(time)
                const isSlotStart = item?.start_time === time
                const genderColors = getGenderAccentColors(item?.gender)

                if (item && !isSlotStart) return null

                return (
                  <div
                    key={time}
                    className={cn(
                      'flex items-stretch gap-4 min-h-[60px]',
                      !item && 'hover:bg-accent/50 rounded-lg cursor-pointer'
                    )}
                    onClick={() => !item && setIsDialogOpen(true)}
                  >
                    <div className="w-16 flex-shrink-0 text-sm text-muted-foreground py-2">
                      {time}
                    </div>

                    {item ? (
                      <div
                        className={cn(
                          'flex-1 rounded-lg p-3 border-l-4',
                          (item.status === 'canceled' || item.status === 'cancelled') && 'opacity-50',
                        )}
                        style={{
                          borderLeftColor: genderColors.border,
                          backgroundColor: genderColors.background,
                        }}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium">{item.clientName}</p>
                            <p className="text-sm text-muted-foreground">
                              {item.serviceName} • {formatTime(item.start_time)} - {formatTime(item.end_time)}
                              {item.kind === 'booking' ? ' • Reserva online' : ''}
                            </p>
                          </div>
                          <div className="text-right">
                            <Badge variant="secondary" className="text-xs capitalize">
                              {item.kind === 'booking'
                                ? item.status
                                : APPOINTMENT_STATUS[item.status as Appointment['status']]?.label ?? item.status}
                            </Badge>
                            {typeof item.price === 'number' ? (
                              <p className="text-sm font-medium mt-1">{formatCurrency(item.price)}</p>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 border border-dashed border-border rounded-lg flex items-center justify-center text-muted-foreground text-sm">
                        <Plus className="size-4 mr-1" />
                        Horário livre
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
