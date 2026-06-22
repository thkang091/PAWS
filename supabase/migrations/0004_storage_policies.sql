insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dog-moments', 'dog-moments', false, 10485760, array['image/jpeg', 'image/png', 'image/heic'])
on conflict (id) do update set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/heic'];

create policy "dog moment upload owner folder"
on storage.objects for insert
with check (
  bucket_id = 'dog-moments'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "dog moment read owner folder"
on storage.objects for select
using (
  bucket_id = 'dog-moments'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "dog moment delete owner folder"
on storage.objects for delete
using (
  bucket_id = 'dog-moments'
  and auth.uid()::text = (storage.foldername(name))[1]
);
