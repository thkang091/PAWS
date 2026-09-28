create or replace function public.bootstrap_user_profile()
returns profiles
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  result profiles;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  insert into profiles (id)
  values (auth.uid())
  on conflict (id) do nothing;

  select * into result from profiles where id = auth.uid();
  return result;
end;
$$;

revoke all on function public.bootstrap_user_profile() from public;
revoke execute on function public.bootstrap_user_profile() from anon;
grant execute on function public.bootstrap_user_profile() to authenticated;
