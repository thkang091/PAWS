alter table reward_redemptions
  add column if not exists provider_reference text,
  add column if not exists fulfillment_note text,
  add column if not exists rejection_reason text,
  add column if not exists fulfilled_at timestamptz;

create or replace function update_reward_redemption_fulfillment(
  target_redemption_id uuid,
  target_status redemption_status,
  provider_reference_value text default null,
  fulfillment_note_value text default null,
  rejection_reason_value text default null
)
returns reward_redemptions
language plpgsql
security definer
set search_path = public
as $$
declare
  redemption reward_redemptions;
begin
  if target_status not in ('processing', 'fulfilled', 'rejected') then
    raise exception 'Unsupported fulfillment status';
  end if;

  select * into redemption
  from reward_redemptions
  where id = target_redemption_id
  for update;

  if redemption.id is null then
    raise exception 'Reward redemption not found';
  end if;

  if redemption.status = 'fulfilled' and target_status <> 'fulfilled' then
    raise exception 'Fulfilled redemptions cannot be moved backward';
  end if;

  if target_status = 'rejected' and coalesce(trim(rejection_reason_value), '') = '' then
    raise exception 'Rejection reason is required';
  end if;

  update reward_redemptions
  set
    status = target_status,
    provider_reference = nullif(trim(coalesce(provider_reference_value, provider_reference)), ''),
    fulfillment_note = nullif(trim(coalesce(fulfillment_note_value, fulfillment_note)), ''),
    rejection_reason = case
      when target_status = 'rejected' then nullif(trim(rejection_reason_value), '')
      else rejection_reason
    end,
    fulfilled_at = case
      when target_status = 'fulfilled' then timezone('utc', now())
      else fulfilled_at
    end,
    updated_at = timezone('utc', now())
  where id = target_redemption_id
  returning * into redemption;

  insert into audit_logs(actor_user_id, dog_id, action_type, source_entity_type, source_entity_id, metadata)
  values (
    null,
    redemption.dog_id,
    case
      when target_status = 'fulfilled' then 'reward_redemption_fulfilled'
      when target_status = 'rejected' then 'reward_redemption_rejected'
      else 'reward_redemption_processing'
    end,
    'reward_redemption',
    redemption.id,
    jsonb_build_object(
      'status', redemption.status,
      'providerReferencePresent', redemption.provider_reference is not null,
      'hasFulfillmentNote', redemption.fulfillment_note is not null,
      'hasRejectionReason', redemption.rejection_reason is not null
    )
  );

  return redemption;
end;
$$;

revoke all on function update_reward_redemption_fulfillment(uuid, redemption_status, text, text, text) from public;
revoke all on function update_reward_redemption_fulfillment(uuid, redemption_status, text, text, text) from anon, authenticated;
grant execute on function update_reward_redemption_fulfillment(uuid, redemption_status, text, text, text) to service_role;
