-- Our Network is een GAST-APP in het gedeelde Supabase-project van Be Strong (zie SUPABASE_SHARED.md).
-- Alles heeft het prefix net_ (tabellen, functies, policies, indexen) of net- (storage-bucket).
-- Dit bestand raakt niets van Be Strong of Boodschappenlijst aan en werkt nooit op een heel schema.

begin;

-- Supabase Storage: één PRIVÉ bucket voor profielfoto's en herinneringen.
--   avatars/profiles/<profile_id>/<uuid>.jpg
--   avatars/persons/<person_id>/<uuid>.jpg
--   events/<event_id>/<uuid>.jpg (+ <uuid>_thumb.jpg)
-- Alleen leden mogen lezen, uploaden, vervangen en verwijderen. Weergave via kortlevende signed URLs.
-- (Overgeslagen als het storage-schema niet bestaat, bv. in de lokale testdatabase.)

do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'storage') then
    raise notice 'storage-schema ontbreekt: bucket en policies overgeslagen';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('net-photos', 'net-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

  execute $p$
    create policy net_photos_select on storage.objects for select to authenticated
      using (bucket_id = 'net-photos' and public.net_is_member())
  $p$;
  execute $p$
    create policy net_photos_insert on storage.objects for insert to authenticated
      with check (
        bucket_id = 'net-photos' and public.net_is_member()
        and name ~ '^(avatars/(profiles|persons)/[0-9a-f-]{36}|events/[0-9a-f-]{36})/[0-9a-f-]{36}(_thumb)?\.(jpg|png|webp)$'
      )
  $p$;
  execute $p$
    create policy net_photos_update on storage.objects for update to authenticated
      using (bucket_id = 'net-photos' and public.net_is_member())
      with check (bucket_id = 'net-photos' and public.net_is_member())
  $p$;
  execute $p$
    create policy net_photos_delete on storage.objects for delete to authenticated
      using (bucket_id = 'net-photos' and public.net_is_member())
  $p$;
end;
$$;

commit;
