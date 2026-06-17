-- Fix public booking INSERT blocked by RLS:
-- bookings_insert_anon subquery on profiles fails because anon has no SELECT on profiles.

create or replace function public.is_bookable_professional(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_id
      and p.role = 'professional'
      and p.slug is not null
      and p.is_active = true
      and coalesce(p.is_blocked, false) = false
  );
$$;

revoke all on function public.is_bookable_professional(uuid) from public;
grant execute on function public.is_bookable_professional(uuid) to anon, authenticated;

drop policy if exists "bookings_insert_anon" on public.bookings;
create policy "bookings_insert_anon"
  on public.bookings for insert to anon
  with check (public.is_bookable_professional(professional_id));

drop policy if exists "bookings_insert_authenticated_public" on public.bookings;
create policy "bookings_insert_authenticated_public"
  on public.bookings for insert to authenticated
  with check (public.is_bookable_professional(professional_id));

create or replace function public.create_public_booking(
  p_slug text,
  p_service_id uuid,
  p_client_name text,
  p_client_phone text,
  p_slot timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_professional_id uuid;
  v_service_name text;
  v_booking_id uuid;
begin
  if coalesce(trim(p_client_name), '') = '' or coalesce(trim(p_client_phone), '') = '' then
    raise exception 'Preencha todos os campos.';
  end if;

  if p_slot is null then
    raise exception 'Horário inválido.';
  end if;

  select p.id
  into v_professional_id
  from public.profiles p
  where lower(p.slug) = lower(trim(p_slug))
    and p.role = 'professional'
    and p.slug is not null
    and p.is_active = true
    and coalesce(p.is_blocked, false) = false
  limit 1;

  if v_professional_id is null then
    raise exception 'Profissional não encontrado.';
  end if;

  select s.name
  into v_service_name
  from public.services s
  where s.id = p_service_id
    and s.professional_id = v_professional_id
    and s.is_active = true;

  if v_service_name is null then
    raise exception 'Serviço inválido para este profissional.';
  end if;

  insert into public.bookings (
    professional_id,
    client_name,
    client_phone,
    service,
    date,
    status
  )
  values (
    v_professional_id,
    trim(p_client_name),
    trim(p_client_phone),
    v_service_name,
    p_slot,
    'pending'
  )
  returning id into v_booking_id;

  return v_booking_id;
end;
$$;

revoke all on function public.create_public_booking(text, uuid, text, text, timestamptz) from public;
grant execute on function public.create_public_booking(text, uuid, text, text, timestamptz) to anon, authenticated;
