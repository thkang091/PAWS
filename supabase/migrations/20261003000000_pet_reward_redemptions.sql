-- Pet Shop gift cards: gold coins redeemed for real pet-store gift cards through Tremendous.
--
-- Lifecycle: pending (coins held, order not yet confirmed) -> issued (Tremendous accepted it)
--                                                           -> failed (Tremendous refused it; coins returned)
-- cancelled is for a later manual reversal. Only the pet-rewards edge function (service role) can write here.

create type public.pet_reward_status as enum ('pending', 'issued', 'failed', 'cancelled');

create table public.pet_reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  dog_id uuid not null references public.dogs(id) on delete cascade,
  -- One per tap of "Redeem" on the device; a retried or double-tapped request reuses it.
  request_key text not null,
  product_id text not null,
  merchant text not null,
  value_cents integer not null check (value_cents > 0),
  currency_code text not null default 'USD',
  gold_cost integer not null check (gold_cost > 0),
  status public.pet_reward_status not null default 'pending',
  -- Sent to Tremendous as external_id; Tremendous returns the first order for a repeat, so a card is never issued twice.
  external_id text not null unique,
  provider_order_id text,
  provider_reward_id text,
  failure_code text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (owner_id, request_key)
);

-- One redemption in flight per dog: a second concurrent request waits for the first to settle.
create unique index pet_reward_redemptions_one_pending_idx on public.pet_reward_redemptions (dog_id) where status = 'pending';
create index pet_reward_redemptions_owner_idx on public.pet_reward_redemptions (owner_id, created_at desc);

alter table public.pet_reward_redemptions enable row level security;

-- People read their own history. There are no insert, update or delete policies: only the functions below write.
create policy pet_reward_redemptions_select_own on public.pet_reward_redemptions
  for select using (owner_id = auth.uid());

-- Take the coins and record the redemption together, or do neither.
create or replace function public.begin_pet_reward_redemption(
  p_owner_id uuid,
  p_dog_id uuid,
  p_request_key text,
  p_product_id text,
  p_merchant text,
  p_value_cents integer,
  p_gold_cost integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row pet_reward_redemptions;
  v_id uuid := gen_random_uuid();
begin
  select * into v_row from pet_reward_redemptions where owner_id = p_owner_id and request_key = p_request_key;
  if v_row.id is not null then
    return to_jsonb(v_row);
  end if;

  if not exists (select 1 from dogs where id = p_dog_id and owner_id = p_owner_id) then
    raise exception 'dog_not_found';
  end if;

  begin
    insert into pet_reward_redemptions (id, owner_id, dog_id, request_key, product_id, merchant, value_cents, gold_cost, external_id)
    values (v_id, p_owner_id, p_dog_id, p_request_key, p_product_id, p_merchant, p_value_cents, p_gold_cost, 'paws-pet-' || v_id::text)
    returning * into v_row;
  exception when unique_violation then
    -- Either this request key raced itself (return that row) or another redemption is still in flight.
    select * into v_row from pet_reward_redemptions where owner_id = p_owner_id and request_key = p_request_key;
    if v_row.id is not null then
      return to_jsonb(v_row);
    end if;
    raise exception 'redemption_in_progress';
  end;

  -- Raises insufficient_gold_balance and rolls the insert back if the dog cannot afford it.
  perform apply_wallet_transaction(
    p_dog_id, 'gold_coin', -p_gold_cost,
    'pet_reward_redemption', 'pet-reward-' || v_id::text, 'pet_reward_redemptions', v_id
  );

  return to_jsonb(v_row);
end;
$$;

create or replace function public.complete_pet_reward_redemption(p_id uuid, p_order_id text, p_reward_id text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  update pet_reward_redemptions
     set status = 'issued', provider_order_id = p_order_id, provider_reward_id = coalesce(p_reward_id, provider_reward_id),
         updated_at = timezone('utc', now())
   where id = p_id and status in ('pending', 'issued');
end;
$$;

-- Tremendous refused the order: mark it failed and give the coins back, once.
create or replace function public.fail_pet_reward_redemption(p_id uuid, p_code text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row pet_reward_redemptions;
begin
  select * into v_row from pet_reward_redemptions where id = p_id for update;
  if v_row.id is null or v_row.status <> 'pending' then
    return;
  end if;

  update pet_reward_redemptions
     set status = 'failed', failure_code = left(p_code, 60), updated_at = timezone('utc', now())
   where id = p_id;

  perform apply_wallet_transaction(
    v_row.dog_id, 'gold_coin', v_row.gold_cost,
    'pet_reward_refund', 'pet-reward-refund-' || v_row.id::text, 'pet_reward_redemptions', v_row.id
  );
end;
$$;

revoke execute on function public.begin_pet_reward_redemption(uuid, uuid, text, text, text, integer, integer) from public, anon, authenticated;
revoke execute on function public.complete_pet_reward_redemption(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.fail_pet_reward_redemption(uuid, text) from public, anon, authenticated;
grant execute on function public.begin_pet_reward_redemption(uuid, uuid, text, text, text, integer, integer) to service_role;
grant execute on function public.complete_pet_reward_redemption(uuid, text, text) to service_role;
grant execute on function public.fail_pet_reward_redemption(uuid, text) to service_role;
