create table user_equipped_avatar_items (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references dogs(id) on delete cascade,
  owner_id uuid not null references profiles(id) on delete cascade,
  slot_type text not null check (slot_type in ('neck', 'outfit', 'background', 'dog_tag_frame')),
  avatar_item_id uuid not null references avatar_catalog(id),
  equipped_at timestamptz not null default timezone('utc', now()),
  unique(dog_id, slot_type)
);

alter table avatar_catalog add column if not exists slot_type text not null default 'neck' check (slot_type in ('neck', 'outfit', 'background', 'dog_tag_frame'));
alter table user_equipped_avatar_items enable row level security;
create policy "equipped avatar own all" on user_equipped_avatar_items for all using (owner_id = auth.uid()) with check (owner_id = auth.uid() and owns_dog(dog_id));

insert into avatar_catalog(slug, name, silver_cost, asset_key, slot_type) values
('sunny-park-background','Sunny Park Background',220,'sunny-park-background','background'),
('classic-dog-tag-frame','Classic Dog Tag Frame',140,'classic-dog-tag-frame','dog_tag_frame')
on conflict (slug) do update set name = excluded.name, silver_cost = excluded.silver_cost, slot_type = excluded.slot_type, updated_at = timezone('utc', now());

update avatar_catalog set slot_type = 'neck' where slug in ('green-bandana', 'orange-bandana', 'star-collar');
update avatar_catalog set slot_type = 'outfit' where slug = 'cozy-sweater';

create or replace function purchase_avatar_item(target_dog_id uuid, target_avatar_item_id uuid, request_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  item avatar_catalog;
  owned user_avatar_items;
  silver integer;
begin
  if not owns_dog(target_dog_id) then raise exception 'Dog not found'; end if;
  select * into item from avatar_catalog where id = target_avatar_item_id and is_active;
  if item.id is null then raise exception 'Avatar item unavailable'; end if;
  if exists(select 1 from user_avatar_items where dog_id = target_dog_id and avatar_item_id = item.id) then
    raise exception 'Avatar item already owned';
  end if;
  silver := wallet_total(target_dog_id, 'silver');
  if silver < item.silver_cost then raise exception 'Insufficient silver balance'; end if;
  insert into user_avatar_items(owner_id, dog_id, avatar_item_id)
  values (auth.uid(), target_dog_id, item.id)
  returning * into owned;
  insert into wallet_transactions(owner_id, dog_id, currency, amount, reason, source_entity_type, source_entity_id, idempotency_key)
  values (auth.uid(), target_dog_id, 'silver', -item.silver_cost, 'avatar_purchase', 'avatar_item', item.id, request_key || ':silver');
  perform write_audit_log('avatar_item_purchased', target_dog_id, 'avatar_item', item.id, jsonb_build_object('silverCost', item.silver_cost));
  return jsonb_build_object('item', to_jsonb(owned), 'wallet', jsonb_build_object('silverBalance', silver - item.silver_cost, 'goldBalance', wallet_total(target_dog_id, 'gold')));
exception
  when unique_violation then raise exception 'Avatar item already owned';
end;
$$;

create or replace function equip_avatar_item(target_dog_id uuid, target_avatar_item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  item avatar_catalog;
  equipped user_equipped_avatar_items;
begin
  if not owns_dog(target_dog_id) then raise exception 'Dog not found'; end if;
  select ac.* into item from avatar_catalog ac
  join user_avatar_items uai on uai.avatar_item_id = ac.id and uai.dog_id = target_dog_id
  where ac.id = target_avatar_item_id;
  if item.id is null then raise exception 'Avatar item is not owned'; end if;
  insert into user_equipped_avatar_items(dog_id, owner_id, slot_type, avatar_item_id)
  values (target_dog_id, auth.uid(), item.slot_type, item.id)
  on conflict (dog_id, slot_type) do update set avatar_item_id = excluded.avatar_item_id, equipped_at = timezone('utc', now())
  returning * into equipped;
  perform write_audit_log('avatar_item_equipped', target_dog_id, 'avatar_item', item.id, jsonb_build_object('slot', item.slot_type));
  return to_jsonb(equipped);
end;
$$;
