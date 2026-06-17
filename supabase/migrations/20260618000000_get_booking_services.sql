-- RPC pública: serviços ativos do profissional para agendamento online.

create or replace function public.get_booking_services(p_id uuid)
returns table (
  id uuid,
  name text,
  duration_minutes integer,
  price numeric,
  display_order integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id,
    s.name,
    s.duration_minutes,
    s.price,
    s.display_order
  from public.services s
  where s.professional_id = p_id
    and s.is_active = true
  order by s.display_order asc, s.name asc;
$$;

revoke all on function public.get_booking_services(uuid) from public;
grant execute on function public.get_booking_services(uuid) to anon, authenticated;
