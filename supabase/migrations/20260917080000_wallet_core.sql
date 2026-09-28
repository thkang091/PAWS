create type public.currency_type as enum ('silver_coin', 'gold_coin');

create table public.dog_wallets (
  dog_id uuid primary key references public.dogs(id) on delete cascade,
  silver_balance integer not null default 0 check (silver_balance >= 0),
  gold_balance integer not null default 0 check (gold_balance >= 0),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  dog_id uuid not null references public.dogs(id) on delete cascade,
  currency public.currency_type not null,
  amount integer not null check (amount <> 0),
  reason text not null,
  source_entity_type text,
  source_entity_id uuid,
  idempotency_key text not null unique,
  created_at timestamptz not null default timezone('utc', now())
);

create index wallet_transactions_dog_id_idx on public.wallet_transactions (dog_id, created_at desc);
create index wallet_transactions_owner_id_idx on public.wallet_transactions (owner_id);

alter table public.dog_wallets enable row level security;
alter table public.wallet_transactions enable row level security;

create policy dog_wallets_select_own on public.dog_wallets
  for select using (owns_dog(dog_id));

create policy wallet_transactions_select_own on public.wallet_transactions
  for select using (owns_dog(dog_id));

create or replace function public.apply_wallet_transaction(
  p_dog_id uuid,
  p_currency public.currency_type,
  p_amount integer,
  p_reason text,
  p_idempotency_key text,
  p_source_entity_type text default null,
  p_source_entity_id uuid default null
)
returns public.wallet_transactions
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_owner_id uuid;
  v_existing public.wallet_transactions;
  v_new public.wallet_transactions;
  v_current_silver integer;
  v_current_gold integer;
begin
  select * into v_existing from wallet_transactions where idempotency_key = p_idempotency_key;
  if v_existing.id is not null then
    return v_existing;
  end if;

  select owner_id into v_owner_id from dogs where id = p_dog_id;
  if v_owner_id is null then
    raise exception 'Dog not found';
  end if;

  insert into dog_wallets (dog_id) values (p_dog_id)
    on conflict (dog_id) do nothing;

  select silver_balance, gold_balance into v_current_silver, v_current_gold
    from dog_wallets where dog_id = p_dog_id for update;

  if p_currency = 'silver_coin' and v_current_silver + p_amount < 0 then
    raise exception 'insufficient_silver_balance';
  end if;
  if p_currency = 'gold_coin' and v_current_gold + p_amount < 0 then
    raise exception 'insufficient_gold_balance';
  end if;

  update dog_wallets set
    silver_balance = case when p_currency = 'silver_coin' then silver_balance + p_amount else silver_balance end,
    gold_balance = case when p_currency = 'gold_coin' then gold_balance + p_amount else gold_balance end,
    updated_at = timezone('utc', now())
  where dog_id = p_dog_id;

  begin
    insert into wallet_transactions (owner_id, dog_id, currency, amount, reason, source_entity_type, source_entity_id, idempotency_key)
    values (v_owner_id, p_dog_id, p_currency, p_amount, p_reason, p_source_entity_type, p_source_entity_id, p_idempotency_key)
    returning * into v_new;
  exception when unique_violation then
    update dog_wallets set
      silver_balance = case when p_currency = 'silver_coin' then silver_balance - p_amount else silver_balance end,
      gold_balance = case when p_currency = 'gold_coin' then gold_balance - p_amount else gold_balance end
    where dog_id = p_dog_id;
    select * into v_new from wallet_transactions where idempotency_key = p_idempotency_key;
    return v_new;
  end;

  return v_new;
end;
$$;

revoke execute on function public.apply_wallet_transaction(uuid, public.currency_type, integer, text, text, text, uuid) from anon, authenticated;

create or replace function public.get_wallet_summary(target_dog_id uuid)
returns table (silver_balance integer, gold_balance integer)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select coalesce(w.silver_balance, 0), coalesce(w.gold_balance, 0)
  from (select target_dog_id as dog_id) d
  left join dog_wallets w on w.dog_id = d.dog_id
  where owns_dog(target_dog_id);
$$;
