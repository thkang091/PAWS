-- Temporary free refill. Keep session/history rows and the daily allowance intact.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.reset_training_energy(p_dog_id uuid, p_local_date date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.owns_dog(p_dog_id) then raise exception 'Dog not found'; end if;
  if p_local_date is null or abs(p_local_date - (now() at time zone 'UTC')::date) > 1 then
    raise exception 'Invalid local date';
  end if;

  -- Serialize repeated refill requests for this dog. New session charges still count.
  perform pg_advisory_xact_lock(hashtextextended('energy_reset:' || p_dog_id::text, 0));
  update public.training_energy_ledger
  set reason = reason || ':free_reset(' || delta::text || ')', delta = 0
  where dog_id = p_dog_id and effective_local_day = p_local_date and delta < 0;

  return public.get_training_energy(p_dog_id, p_local_date);
end;
$$;
revoke all on function private.reset_training_energy(uuid, date) from public, anon;
grant execute on function private.reset_training_energy(uuid, date) to authenticated;

create or replace function public.reset_training_energy(p_dog_id uuid, p_local_date date)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.reset_training_energy(p_dog_id, p_local_date);
$$;
revoke all on function public.reset_training_energy(uuid, date) from public, anon;
grant execute on function public.reset_training_energy(uuid, date) to authenticated;
