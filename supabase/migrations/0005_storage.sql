-- Character portrait storage (see plan §7 "Character images").
insert into storage.buckets (id, name, public)
values ('character-images', 'character-images', true)
on conflict (id) do nothing;

create policy character_images_public_read
  on storage.objects for select
  using (bucket_id = 'character-images');

-- No insert/update/delete policy for anon/authenticated: uploads only happen
-- via scripts/import-characters.ts using the service-role key, which
-- bypasses storage RLS the same way it bypasses table RLS.
