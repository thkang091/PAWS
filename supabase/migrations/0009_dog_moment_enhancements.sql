alter table dog_moments
  add column if not exists is_favorite boolean not null default false,
  add column if not exists visibility text not null default 'private' check (visibility in ('private', 'share_link')),
  add column if not exists edited_at timestamptz;

create or replace function update_dog_moment_details(
  target_moment_id uuid,
  caption_value text,
  is_favorite_value boolean,
  visibility_value text
)
returns dog_moments
language plpgsql
security definer
set search_path = public
as $$
declare
  moment dog_moments;
begin
  select * into moment from dog_moments where id = target_moment_id and owner_id = auth.uid();
  if moment.id is null then raise exception 'Dog Moment not found'; end if;
  if visibility_value not in ('private', 'share_link') then raise exception 'Invalid visibility'; end if;
  update dog_moments
  set caption = caption_value, is_favorite = is_favorite_value, visibility = visibility_value, edited_at = timezone('utc', now())
  where id = target_moment_id
  returning * into moment;
  return moment;
end;
$$;
