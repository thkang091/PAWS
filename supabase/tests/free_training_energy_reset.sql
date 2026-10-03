-- Run as a database administrator; every test change is rolled back.
begin;
do $$
declare
  dog public.dogs;
  today date := (now() at time zone 'UTC')::date;
  result jsonb;
  session_count bigint;
  history_count bigint;
  test_entry uuid;
  blocked boolean := false;
begin
  select * into strict dog from public.dogs order by created_at limit 1;
  select count(*) into session_count from public.training_sessions where dog_id = dog.id;
  select count(*) into history_count from public.training_energy_ledger where dog_id = dog.id;
  insert into public.training_energy_ledger (dog_id, effective_local_day, delta, reason)
  values (dog.id, today, -1, 'refill_verification') returning id into test_entry;
  perform set_config('request.jwt.claim.sub', dog.owner_id::text, true);
  result := public.reset_training_energy(dog.id, today);
  if (result->>'remaining')::int <> (result->>'base')::int or (result->>'consumed')::int <> 0 then
    raise exception 'Refill did not restore base allowance: %', result;
  end if;
  if public.reset_training_energy(dog.id, today) <> result then raise exception 'Repeated refill changed allowance'; end if;
  if not exists (select 1 from public.training_energy_ledger where id = test_entry and delta = 0 and reason = 'refill_verification:free_reset(-1)') then
    raise exception 'Reset did not preserve audit row';
  end if;
  if (select count(*) from public.training_energy_ledger where dog_id = dog.id) <> history_count + 1 then raise exception 'Ledger rows lost'; end if;
  if (select count(*) from public.training_sessions where dog_id = dog.id) <> session_count then raise exception 'Training history changed'; end if;
  -- A subsequent session charge must still consume one energy.
  insert into public.training_energy_ledger (dog_id, effective_local_day, delta, reason)
  values (dog.id, today, -1, 'refill_verification_after');
  if (public.get_training_energy(dog.id, today)->>'remaining')::int <> greatest(0, (result->>'base')::int - 1) then
    raise exception 'Subsequent charge was ignored';
  end if;
  perform set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
  begin
    perform public.reset_training_energy(dog.id, today);
  exception when others then
    if sqlerrm <> 'Dog not found' then raise; end if;
    blocked := true;
  end;
  if not blocked then raise exception 'Non-owner refill allowed'; end if;
  if has_function_privilege('anon', 'public.reset_training_energy(uuid,date)', 'EXECUTE') then raise exception 'Unauthenticated execution allowed'; end if;
  if not has_function_privilege('authenticated', 'public.reset_training_energy(uuid,date)', 'EXECUTE') then raise exception 'Authenticated execution missing'; end if;
end;
$$;
rollback;
select 'PASS: refill, repeat, audit preservation, subsequent charge, ownership, permissions; test data rolled back' as verification;
