-- Storage bucket for person profile photos.
-- Objects are stored at: {tree_id}/{person_id}/{filename}
-- so RLS can authorize purely from the path, reusing is_tree_member().

insert into storage.buckets (id, name, public)
values ('person-photos', 'person-photos', true)
on conflict (id) do nothing;

-- Public read (photos are shown as <img src> without a signed URL).
create policy "person_photos_public_read" on storage.objects
  for select using (bucket_id = 'person-photos');

create policy "person_photos_insert_editor" on storage.objects
  for insert with check (
    bucket_id = 'person-photos'
    and public.is_tree_member(((storage.foldername(name))[1])::uuid, 'editor')
  );

create policy "person_photos_update_editor" on storage.objects
  for update using (
    bucket_id = 'person-photos'
    and public.is_tree_member(((storage.foldername(name))[1])::uuid, 'editor')
  );

create policy "person_photos_delete_editor" on storage.objects
  for delete using (
    bucket_id = 'person-photos'
    and public.is_tree_member(((storage.foldername(name))[1])::uuid, 'editor')
  );
