revoke all on function public.apply_wallet_transaction(uuid, public.currency_type, integer, text, text, text, uuid) from public;
revoke all on function public.approve_challenge_submission(uuid, text, text) from public;
revoke all on function public.training_energy_base(uuid) from public;
revoke all on function public.generate_dog_tag() from public;
revoke all on function public.set_updated_at() from public;

do $$
declare
  fn text;
  fns text[] := array[
    'public.create_dog_profile(text, public.dog_gender, date, numeric, text, date, date, public.obedience_level, public.energy_level, text[], uuid[], uuid[], text[], text)',
    'public.owns_dog(uuid)',
    'public.resolve_skill_session(uuid, uuid)',
    'public.get_training_energy(uuid, date)',
    'public.start_training_session(uuid, uuid, date, text)',
    'public.set_session_card_position(uuid, text)',
    'public.report_training_result(uuid, text, uuid)',
    'public.end_training_session(uuid, text)',
    'public.get_wallet_summary(uuid)',
    'public.complete_dog_care_routine(uuid, date, text)',
    'public.enter_game(uuid, uuid, text)',
    'public.start_challenge_game_attempt(uuid, uuid, text)',
    'public.purchase_coupon(uuid, uuid, text)',
    'public.purchase_avatar_item(uuid, uuid, text)',
    'public.equip_avatar_item(uuid, uuid)',
    'public.purchase_shop_item(uuid, uuid, integer, text)',
    'public.get_profile_dashboard(uuid)'
  ];
begin
  foreach fn in array fns loop
    execute format('revoke all on function %s from public;', fn);
    execute format('grant execute on function %s to authenticated;', fn);
  end loop;
end $$;

do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'bootstrap_user_profile'
  ) then
    execute 'revoke all on function public.bootstrap_user_profile() from public';
    execute 'grant execute on function public.bootstrap_user_profile() to authenticated';
  end if;
end $$;
