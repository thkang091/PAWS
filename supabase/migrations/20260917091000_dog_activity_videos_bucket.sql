insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dog-activity-videos', 'dog-activity-videos', false, 209715200, array['video/mp4', 'video/quicktime'])
on conflict (id) do nothing;

create policy dog_activity_videos_insert_own on storage.objects
  for insert
  with check (
    bucket_id = 'dog-activity-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy dog_activity_videos_select_own on storage.objects
  for select
  using (
    bucket_id = 'dog-activity-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy dog_activity_videos_update_own on storage.objects
  for update
  using (
    bucket_id = 'dog-activity-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
