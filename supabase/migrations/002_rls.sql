-- Our Network is een GAST-APP in het gedeelde Supabase-project van Be Strong (zie SUPABASE_SHARED.md).
-- Alles heeft het prefix net_ (tabellen, functies, policies, indexen) of net- (storage-bucket).
-- Dit bestand raakt niets van Be Strong of Boodschappenlijst aan en werkt nooit op een heel schema.

begin;

-- Row Level Security voor de gedeelde netwerkruimte.
--  * Alleen leden (public.net_members) zien of wijzigen iets. anon heeft nergens toegang.
--  * Geen DELETE-policies op datatabellen: verwijderen gebeurt via deleted_at (soft delete),
--    zodat herinneringen nooit definitief verdwijnen vanuit de app.
--  * Privé-herinneringen (events.is_private) zijn enkel zichtbaar voor wie ze aanmaakte,
--    net als hun koppelingen en foto's.

-- ───────────────────────── lidmaatschap ─────────────────────────
create or replace function public.net_is_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.net_members m where m.user_id = (select auth.uid()));
$$;

-- Wordt na elke login aangeroepen. Maakt de ingelogde gebruiker lid als:
--  * er nog geen enkel lid is (eerste installatie), of
--  * zijn/haar e-mailadres in allowed_emails staat.
create or replace function public.net_claim_membership()
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  mail text;
begin
  if uid is null then
    return false;
  end if;
  if exists (select 1 from public.net_members where user_id = uid) then
    return true;
  end if;
  select lower(u.email) into mail from auth.users u where u.id = uid;
  -- Voorkomt dat twee gelijktijdige eerste logins allebei "eerste lid" worden.
  lock table public.net_members in share row exclusive mode;
  if not exists (select 1 from public.net_members)
     or exists (select 1 from public.net_allowed_emails a where a.email = mail) then
    insert into public.net_members (user_id, email) values (uid, coalesce(mail, '')) on conflict do nothing;
    return true;
  end if;
  return false;
end;
$$;

-- Is een gebeurtenis zichtbaar voor de huidige gebruiker? (RLS van events geldt hier, security invoker)
create or replace function public.net_event_visible(ev_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (select 1 from public.net_events e where e.id = ev_id);
$$;

create or replace function public.net_photo_visible(ph_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (select 1 from public.net_event_photos p where p.id = ph_id);
$$;

-- Functies: enkel ingelogde gebruikers; anon en public niets. Alleen eigen net_-functies.
revoke all on function public.net_set_row_meta() from public, anon, authenticated;
revoke all on function public.net_is_member() from public, anon;
revoke all on function public.net_claim_membership() from public, anon;
revoke all on function public.net_event_visible(uuid) from public, anon;
revoke all on function public.net_photo_visible(uuid) from public, anon;
grant execute on function public.net_is_member() to authenticated;
grant execute on function public.net_claim_membership() to authenticated;
grant execute on function public.net_event_visible(uuid) to authenticated;
grant execute on function public.net_photo_visible(uuid) to authenticated;

-- ───────────────────────── rechten ─────────────────────────
-- Gedeeld Supabase-project (Be Strong, Boodschappenlijst): rechten ENKEL per eigen net_-tabel.
-- Nooit een opdracht op een heel schema ("on all tables in schema public").
do $$
declare t text;
begin
  foreach t in array array[
    'net_members', 'net_allowed_emails', 'net_profiles', 'net_categories', 'net_persons', 'net_person_connections',
    'net_relationships', 'net_network_positions', 'net_contact_history', 'net_event_categories', 'net_events',
    'net_event_persons', 'net_event_profiles', 'net_event_photos', 'net_photo_persons', 'net_relationship_history'
  ] loop
    execute format('revoke all on public.%I from anon, authenticated, public', t);
  end loop;
end;
$$;

alter table public.net_members enable row level security;
alter table public.net_allowed_emails enable row level security;

grant select on public.net_members to authenticated;
grant select, insert, delete on public.net_allowed_emails to authenticated;

create policy net_members_select on public.net_members for select to authenticated using (public.net_is_member());
create policy net_allowed_emails_select on public.net_allowed_emails for select to authenticated using (public.net_is_member());
create policy net_allowed_emails_insert on public.net_allowed_emails for insert to authenticated with check (public.net_is_member());
create policy net_allowed_emails_delete on public.net_allowed_emails for delete to authenticated using (public.net_is_member());

-- Gewone gedeelde datatabellen: lezen, toevoegen en wijzigen voor leden.
do $$
declare t text;
begin
  foreach t in array array[
    'net_profiles', 'net_categories', 'net_persons', 'net_person_connections', 'net_relationships', 'net_network_positions',
    'net_contact_history', 'net_event_categories', 'net_relationship_history'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from authenticated', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.net_is_member())', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.net_is_member())', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.net_is_member()) with check (public.net_is_member())', t || '_update', t);
  end loop;
end;
$$;

-- ── events: privé enkel voor de maker
alter table public.net_events enable row level security;
revoke all on public.net_events from authenticated;
grant select, insert, update on public.net_events to authenticated;
create policy net_events_select on public.net_events for select to authenticated
  using (public.net_is_member() and (not is_private or created_by = (select auth.uid())));
create policy net_events_insert on public.net_events for insert to authenticated
  with check (public.net_is_member() and (not is_private or created_by = (select auth.uid())));
create policy net_events_update on public.net_events for update to authenticated
  using (public.net_is_member() and (not is_private or created_by = (select auth.uid())))
  with check (public.net_is_member() and (not is_private or created_by = (select auth.uid())));

-- ── tabellen die aan een gebeurtenis hangen: volgen de zichtbaarheid van die gebeurtenis
do $$
declare t text;
begin
  foreach t in array array['net_event_persons', 'net_event_profiles', 'net_event_photos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from authenticated', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.net_is_member() and public.net_event_visible(event_id))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.net_is_member() and public.net_event_visible(event_id))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.net_is_member() and public.net_event_visible(event_id)) with check (public.net_is_member() and public.net_event_visible(event_id))', t || '_update', t);
  end loop;
end;
$$;

alter table public.net_photo_persons enable row level security;
revoke all on public.net_photo_persons from authenticated;
grant select, insert, update on public.net_photo_persons to authenticated;
create policy net_photo_persons_select on public.net_photo_persons for select to authenticated
  using (public.net_is_member() and public.net_photo_visible(photo_id));
create policy net_photo_persons_insert on public.net_photo_persons for insert to authenticated
  with check (public.net_is_member() and public.net_photo_visible(photo_id));
create policy net_photo_persons_update on public.net_photo_persons for update to authenticated
  using (public.net_is_member() and public.net_photo_visible(photo_id))
  with check (public.net_is_member() and public.net_photo_visible(photo_id));

commit;
