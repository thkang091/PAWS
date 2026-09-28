create type public.avatar_slot_type as enum ('neck', 'outfit', 'background', 'dog_tag_frame');
create type public.coupon_status as enum ('active', 'inactive', 'sold_out');
create type public.shop_item_category as enum ('food', 'toys', 'furniture', 'clothes');
create type public.shop_item_shelf as enum ('shop', 'pharmacy');

create table public.avatar_catalog (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  silver_cost integer not null default 0 check (silver_cost >= 0),
  asset_key text not null,
  slot_type public.avatar_slot_type not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.user_avatar_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  dog_id uuid not null references public.dogs(id) on delete cascade,
  avatar_item_id uuid not null references public.avatar_catalog(id) on delete cascade,
  acquired_at timestamptz not null default timezone('utc', now()),
  unique (dog_id, avatar_item_id)
);

create table public.user_equipped_avatar_items (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dogs(id) on delete cascade,
  slot_type public.avatar_slot_type not null,
  avatar_item_id uuid not null references public.avatar_catalog(id) on delete cascade,
  updated_at timestamptz not null default timezone('utc', now()),
  unique (dog_id, slot_type)
);

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  gold_coin_cost integer not null check (gold_coin_cost >= 0),
  status public.coupon_status not null default 'active',
  redemption_instructions text not null,
  expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.coupon_purchases (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  dog_id uuid not null references public.dogs(id) on delete cascade,
  gold_coin_cost integer not null,
  status text not null default 'purchased' check (status in ('purchased', 'redeemed', 'cancelled')),
  idempotency_key text not null unique,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.shop_items (
  id uuid primary key default gen_random_uuid(),
  item_key text not null unique,
  name text not null,
  detail text not null,
  category public.shop_item_category not null,
  shelf public.shop_item_shelf not null default 'shop',
  price_gold integer not null check (price_gold >= 0),
  was_price_gold integer,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.shop_purchases (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  dog_id uuid not null references public.dogs(id) on delete cascade,
  shop_item_id uuid not null references public.shop_items(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  gold_coin_cost integer not null,
  idempotency_key text not null unique,
  created_at timestamptz not null default timezone('utc', now())
);

create index user_avatar_items_dog_id_idx on public.user_avatar_items (dog_id);
create index user_equipped_avatar_items_dog_id_idx on public.user_equipped_avatar_items (dog_id);
create index coupon_purchases_dog_id_idx on public.coupon_purchases (dog_id, created_at desc);
create index shop_purchases_dog_id_idx on public.shop_purchases (dog_id, created_at desc);

alter table public.avatar_catalog enable row level security;
alter table public.user_avatar_items enable row level security;
alter table public.user_equipped_avatar_items enable row level security;
alter table public.coupons enable row level security;
alter table public.coupon_purchases enable row level security;
alter table public.shop_items enable row level security;
alter table public.shop_purchases enable row level security;

create policy avatar_catalog_read on public.avatar_catalog for select using (true);
create policy coupons_read on public.coupons for select using (true);
create policy shop_items_read on public.shop_items for select using (true);

create policy user_avatar_items_select_own on public.user_avatar_items for select using (owns_dog(dog_id));
create policy user_equipped_avatar_items_select_own on public.user_equipped_avatar_items for select using (owns_dog(dog_id));
create policy coupon_purchases_select_own on public.coupon_purchases for select using (owns_dog(dog_id));
create policy shop_purchases_select_own on public.shop_purchases for select using (owns_dog(dog_id));

create trigger avatar_catalog_set_updated_at before update on public.avatar_catalog for each row execute function set_updated_at();
create trigger coupons_set_updated_at before update on public.coupons for each row execute function set_updated_at();
create trigger shop_items_set_updated_at before update on public.shop_items for each row execute function set_updated_at();

create or replace function public.purchase_coupon(
  target_dog_id uuid,
  target_coupon_id uuid,
  request_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_coupon coupons;
  v_owner_id uuid;
  v_existing coupon_purchases;
  v_purchase coupon_purchases;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not owns_dog(target_dog_id) then raise exception 'Dog not found'; end if;

  select * into v_existing from coupon_purchases where idempotency_key = request_key;
  if v_existing.id is not null then
    return jsonb_build_object('purchase', to_jsonb(v_existing),
      'wallet', (select jsonb_build_object('silverBalance', silver_balance, 'goldBalance', gold_balance) from get_wallet_summary(target_dog_id)));
  end if;

  select * into v_coupon from coupons where id = target_coupon_id and status = 'active';
  if v_coupon.id is null then raise exception 'Coupon not available'; end if;
  if v_coupon.expires_at is not null and v_coupon.expires_at < timezone('utc', now()) then
    raise exception 'Coupon expired';
  end if;

  select owner_id into v_owner_id from dogs where id = target_dog_id;

  perform apply_wallet_transaction(
    target_dog_id, 'gold_coin', -v_coupon.gold_coin_cost,
    'coupon_purchase', request_key || '-wallet', 'coupons', target_coupon_id
  );

  begin
    insert into coupon_purchases (coupon_id, owner_id, dog_id, gold_coin_cost, idempotency_key)
    values (target_coupon_id, v_owner_id, target_dog_id, v_coupon.gold_coin_cost, request_key)
    returning * into v_purchase;
  exception when unique_violation then
    select * into v_purchase from coupon_purchases where idempotency_key = request_key;
  end;

  return jsonb_build_object('purchase', to_jsonb(v_purchase),
    'wallet', (select jsonb_build_object('silverBalance', silver_balance, 'goldBalance', gold_balance) from get_wallet_summary(target_dog_id)));
end;
$$;

revoke execute on function public.purchase_coupon(uuid, uuid, text) from anon;

create or replace function public.purchase_avatar_item(
  target_dog_id uuid,
  target_avatar_item_id uuid,
  request_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_item avatar_catalog;
  v_owner_id uuid;
  v_existing user_avatar_items;
  v_owned user_avatar_items;
  v_new user_avatar_items;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not owns_dog(target_dog_id) then raise exception 'Dog not found'; end if;

  select * into v_owned from user_avatar_items where dog_id = target_dog_id and avatar_item_id = target_avatar_item_id;
  if v_owned.id is not null then
    raise exception 'already_owned';
  end if;

  select * into v_item from avatar_catalog where id = target_avatar_item_id and is_active;
  if v_item.id is null then raise exception 'Avatar item not available'; end if;

  select owner_id into v_owner_id from dogs where id = target_dog_id;

  perform apply_wallet_transaction(
    target_dog_id, 'silver_coin', -v_item.silver_cost,
    'avatar_item_purchase', request_key || '-wallet', 'avatar_catalog', target_avatar_item_id
  );

  insert into user_avatar_items (owner_id, dog_id, avatar_item_id)
    values (v_owner_id, target_dog_id, target_avatar_item_id)
    on conflict (dog_id, avatar_item_id) do nothing
    returning * into v_new;

  if v_new.id is null then
    select * into v_new from user_avatar_items where dog_id = target_dog_id and avatar_item_id = target_avatar_item_id;
  end if;

  return jsonb_build_object(
    'item', jsonb_build_object('id', v_new.id, 'dog_id', v_new.dog_id, 'avatar_item_id', v_new.avatar_item_id),
    'wallet', (select jsonb_build_object('silverBalance', silver_balance, 'goldBalance', gold_balance) from get_wallet_summary(target_dog_id))
  );
end;
$$;

revoke execute on function public.purchase_avatar_item(uuid, uuid, text) from anon;

create or replace function public.equip_avatar_item(
  target_dog_id uuid,
  target_avatar_item_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_item avatar_catalog;
  v_owned user_avatar_items;
  v_equipped user_equipped_avatar_items;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not owns_dog(target_dog_id) then raise exception 'Dog not found'; end if;

  select * into v_owned from user_avatar_items where dog_id = target_dog_id and avatar_item_id = target_avatar_item_id;
  if v_owned.id is null then raise exception 'Item not owned'; end if;

  select * into v_item from avatar_catalog where id = target_avatar_item_id;

  insert into user_equipped_avatar_items (dog_id, slot_type, avatar_item_id, updated_at)
    values (target_dog_id, v_item.slot_type, target_avatar_item_id, timezone('utc', now()))
    on conflict (dog_id, slot_type) do update set
      avatar_item_id = excluded.avatar_item_id,
      updated_at = timezone('utc', now())
    returning * into v_equipped;

  return jsonb_build_object('id', v_equipped.id, 'dog_id', v_equipped.dog_id, 'slot_type', v_equipped.slot_type, 'avatar_item_id', v_equipped.avatar_item_id);
end;
$$;

revoke execute on function public.equip_avatar_item(uuid, uuid) from anon;

create or replace function public.purchase_shop_item(
  target_dog_id uuid,
  target_shop_item_id uuid,
  quantity_value integer,
  request_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_item shop_items;
  v_owner_id uuid;
  v_existing shop_purchases;
  v_purchase shop_purchases;
  v_total integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not owns_dog(target_dog_id) then raise exception 'Dog not found'; end if;
  if quantity_value < 1 then raise exception 'invalid_quantity'; end if;

  select * into v_existing from shop_purchases where idempotency_key = request_key;
  if v_existing.id is not null then
    return jsonb_build_object('purchase', to_jsonb(v_existing),
      'wallet', (select jsonb_build_object('silverBalance', silver_balance, 'goldBalance', gold_balance) from get_wallet_summary(target_dog_id)));
  end if;

  select * into v_item from shop_items where id = target_shop_item_id and is_active;
  if v_item.id is null then raise exception 'Item not available'; end if;

  v_total := v_item.price_gold * quantity_value;
  select owner_id into v_owner_id from dogs where id = target_dog_id;

  perform apply_wallet_transaction(
    target_dog_id, 'gold_coin', -v_total,
    'shop_item_purchase', request_key || '-wallet', 'shop_items', target_shop_item_id
  );

  begin
    insert into shop_purchases (owner_id, dog_id, shop_item_id, quantity, gold_coin_cost, idempotency_key)
    values (v_owner_id, target_dog_id, target_shop_item_id, quantity_value, v_total, request_key)
    returning * into v_purchase;
  exception when unique_violation then
    select * into v_purchase from shop_purchases where idempotency_key = request_key;
  end;

  return jsonb_build_object('purchase', to_jsonb(v_purchase),
    'wallet', (select jsonb_build_object('silverBalance', silver_balance, 'goldBalance', gold_balance) from get_wallet_summary(target_dog_id)));
end;
$$;

revoke execute on function public.purchase_shop_item(uuid, uuid, integer, text) from anon;
