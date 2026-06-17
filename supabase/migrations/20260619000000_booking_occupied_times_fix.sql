-- Inclui reservas públicas (bookings) e agendamentos internos (appointments) no bloqueio de horários.

create or replace function public.get_booking_occupied_times(p_id uuid, p_day date)
returns setof timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select b.date
  from public.bookings b
  where b.professional_id = p_id
    and (b.date at time zone 'America/Sao_Paulo')::date = p_day
    and b.status in ('pending', 'confirmed')

  union

  select (a.appointment_date::timestamp + a.start_time) at time zone 'America/Sao_Paulo'
  from public.appointments a
  where a.professional_id = p_id
    and a.appointment_date = p_day
    and a.status not in ('canceled', 'cancelled');
$$;

revoke all on function public.get_booking_occupied_times(uuid, date) from public;
grant execute on function public.get_booking_occupied_times(uuid, date) to anon, authenticated;
