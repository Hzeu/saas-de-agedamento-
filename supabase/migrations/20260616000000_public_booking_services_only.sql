-- Public booking must use services table only; remove legacy default catalog values.

alter table public.profiles
  alter column service_catalog set default '[]'::jsonb;

create or replace function public.get_booking_profile(p_slug text)
returns table (
  id uuid,
  full_name text,
  slug text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    coalesce(nullif(trim(p.full_name), ''), 'Profissional') as full_name,
    p.slug
  from public.profiles p
  where lower(p.slug) = lower(trim(p_slug))
    and p.role = 'professional'
    and p.is_active = true
  limit 1;
$$;

revoke all on function public.get_booking_profile(text) from public;
grant execute on function public.get_booking_profile(text) to anon, authenticated;
