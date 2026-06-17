'use client'

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { Loader2, CalendarDays, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  createPublicBooking,
  loadPublicAvailability,
  type AvailabilityResult,
} from '@/lib/actions/bookings'
import { formatSlotLabel } from '@/lib/booking/slots'
import { cn } from '@/lib/utils'

type Props = {
  slug: string
  initialDay: string
  initial: AvailabilityResult | null | undefined
}

function normalizeAvailability(value: AvailabilityResult | null | undefined): AvailabilityResult {
  return {
    profile: {
      id: value?.profile?.id ?? '',
      full_name: value?.profile?.full_name || 'Profissional',
      slug: value?.profile?.slug ?? '',
      services: Array.isArray(value?.profile?.services) ? value.profile.services : [],
    },
    slots: Array.isArray(value?.slots) ? value.slots : [],
  }
}

export function PublicBookingForm({ slug, initialDay, initial }: Props) {
  const initialData = useMemo(() => normalizeAvailability(initial), [initial])
  const minDay = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const [day, setDay] = useState(initialDay)
  const [data, setData] = useState<AvailabilityResult>(initialData)
  const [serviceId, setServiceId] = useState(initialData.profile.services[0]?.id ?? '')
  const [slotIso, setSlotIso] = useState(initialData.slots[0] ?? '')
  const [pending, startTransition] = useTransition()
  const [state, formAction, isSubmitting] = useActionState(createPublicBooking, {})
  const skipFirstFetch = useRef(true)

  useEffect(() => {
    setData(initialData)
    setServiceId(initialData.profile.services[0]?.id ?? '')
    setSlotIso(initialData.slots[0] ?? '')
  }, [initialData])

  useEffect(() => {
    if (state.error) toast.error(state.error)
    if (state.success) toast.success('Agendamento enviado! O profissional irá confirmar.')
  }, [state.error, state.success])

  useEffect(() => {
    if (skipFirstFetch.current && day === initialDay) {
      skipFirstFetch.current = false
      return
    }
    startTransition(async () => {
      const res = await loadPublicAvailability(slug, day)
      if (res.error || !res.data) {
        toast.error(res.error || 'Não foi possível carregar horários.')
        return
      }
      const nextData = normalizeAvailability(res.data)
      setData(nextData)
      setServiceId(nextData.profile.services[0]?.id ?? '')
      setSlotIso(nextData.slots[0] ?? '')
    })
  }, [slug, day, initialDay])

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <div className="mb-8 text-center space-y-2">
        <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Sparkles className="size-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{data.profile.full_name}</h1>
        <p className="text-sm text-muted-foreground">Agende seu horário online</p>
      </div>

      <form action={formAction} className="space-y-5 rounded-2xl border bg-card p-6 shadow-sm">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="serviceId" value={serviceId} />
        <input type="hidden" name="slotIso" value={slotIso} />

        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <CalendarDays className="size-4" />
            Data
          </Label>
          <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} min={minDay} />
        </div>

        <div className="space-y-2">
          <Label>Serviço</Label>
          {!data.profile.services.length ? (
            <p className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-3 text-sm text-muted-foreground">
              Este profissional ainda não cadastrou serviços disponíveis para agendamento online.
              Entre em contato diretamente para mais informações.
            </p>
          ) : (
            <Select value={serviceId} onValueChange={setServiceId}>
              <SelectTrigger className={cn(!serviceId && 'text-muted-foreground')}>
                <SelectValue placeholder="Escolha um serviço" />
              </SelectTrigger>
              <SelectContent>
                {data.profile.services.map((service) => (
                  <SelectItem key={service.id} value={service.id}>
                    {service.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="space-y-2">
          <Label>Horário</Label>
          <Select value={slotIso} onValueChange={setSlotIso} disabled={pending || !data.slots.length}>
            <SelectTrigger className={cn(!slotIso && 'text-muted-foreground')}>
              <SelectValue placeholder={pending ? 'Carregando…' : 'Escolha o horário'} />
            </SelectTrigger>
            <SelectContent>
              {data.slots.map((iso) => (
                <SelectItem key={iso} value={iso}>
                  {formatSlotLabel(iso)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!pending && !data.slots.length && (
            <p className="text-xs text-muted-foreground">Sem horários neste dia. Escolha outra data.</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="clientName">Seu nome</Label>
          <Input id="clientName" name="clientName" required placeholder="Nome completo" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="clientPhone">WhatsApp / telefone</Label>
          <Input id="clientPhone" name="clientPhone" required placeholder="(00) 00000-0000" />
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={isSubmitting || pending || !slotIso || !serviceId || !data.profile.services.length}
        >
          {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
          Confirmar agendamento
        </Button>
      </form>
    </div>
  )
}
