-- Row Level Security voor de gedeelde netwerkruimte.
--  * Alleen leden (public.members) zien of wijzigen iets. anon heeft nergens toegang.
--  * Geen DELETE-policies op datatabellen: verwijderen gebeurt via deleted_at (soft delete),
--    zodat herinneringen nooit definitief verdwijnen vanuit de app.
--  * Privé-herinneringen (events.is_private) zijn enkel zichtbaar voor wie ze aanmaakte,
--    net als hun koppelingen en foto's.

-- ───────────────────────── lidmaatschap ─────────────────────────
create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.members m where m.user_id = (select auth.uid()));
$$;

-- Wordt na elke login aangeroepen. Maakt de ingelogde gebruiker lid als:
--  * er nog geen enkel lid is (eerste installatie), of
--  * zijn/haar e-mailadres in allowed_emails staat.
create or replace function public.claim_membership()
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
  if exists (select 1 from public.members where user_id = uid) then
    return true;
  end if;
  select lower(u.email) into mail from auth.users u where u.id = uid;
  -- Voorkomt dat twee gelijktijdige eerste logins allebei "eerste lid" worden.
  lock table public.members in share row exclusive mode;
  if not exists (select 1 from public.members)
     or exists (select 1 from public.allowed_emails a where a.email = mail) then
    insert into public.members (user_id, email) values (uid, coalesce(mail, '')) on conflict do nothing;
    return true;
  end if;
  return false;
end;
$$;

-- Is een gebeurtenis zichtbaar voor de huidige gebruiker? (RLS van events geldt hier, security invoker)
create or replace function public.event_visible(ev_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (select 1 from public.events e where e.id = ev_id);
$$;

create or replace function public.photo_visible(ph_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (select 1 from public.event_photos p where p.id = ph_id);
$$;

revoke all on function public.is_member() from public, anon;
revoke all on function public.claim_membership() from public, anon;
grant execute on function public.is_member() to authenticated;
grant execute on function public.claim_membership() to authenticated;
grant execute on function public.event_visible(uuid) to authenticated;
grant execute on function public.photo_visible(uuid) to authenticated;

-- ───────────────────────── rechten ─────────────────────────
revoke all on all tables in schema public from anon;

alter table public.members enable row level security;
alter table public.allowed_emails enable row level security;

grant select on public.members to authenticated;
grant select, insert, delete on public.allowed_emails to authenticated;

create policy members_select on public.members for select to authenticated using (public.is_member());
create policy allowed_emails_select on public.allowed_emails for select to authenticated using (public.is_member());
create policy allowed_emails_insert on public.allowed_emails for insert to authenticated with check (public.is_member());
create policy allowed_emails_delete on public.allowed_emails for delete to authenticated using (public.is_member());

-- Gewone gedeelde datatabellen: lezen, toevoegen en wijzigen voor leden.
do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'categories', 'persons', 'person_connections', 'relationships', 'network_positions',
    'contact_history', 'event_categories', 'relationship_history'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from authenticated', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_member())', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.is_member())', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.is_member()) with check (public.is_member())', t || '_update', t);
  end loop;
end;
$$;

-- ── events: privé enkel voor de maker
alter table public.events enable row level security;
revoke all on public.events from authenticated;
grant select, insert, update on public.events to authenticated;
create policy events_select on public.events for select to authenticated
  using (public.is_member() and (not is_private or created_by = (select auth.uid())));
create policy events_insert on public.events for insert to authenticated
  with check (public.is_member() and (not is_private or created_by = (select auth.uid())));
create policy events_update on public.events for update to authenticated
  using (public.is_member() and (not is_private or created_by = (select auth.uid())))
  with check (public.is_member() and (not is_private or created_by = (select auth.uid())));

-- ── tabellen die aan een gebeurtenis hangen: volgen de zichtbaarheid van die gebeurtenis
do $$
declare t text;
begin
  foreach t in array array['event_persons', 'event_profiles', 'event_photos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from authenticated', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_member() and public.event_visible(event_id))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.is_member() and public.event_visible(event_id))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.is_member() and public.event_visible(event_id)) with check (public.is_member() and public.event_visible(event_id))', t || '_update', t);
  end loop;
end;
$$;

alter table public.photo_persons enable row level security;
revoke all on public.photo_persons from authenticated;
grant select, insert, update on public.photo_persons to authenticated;
create policy photo_persons_select on public.photo_persons for select to authenticated
  using (public.is_member() and public.photo_visible(photo_id));
create policy photo_persons_insert on public.photo_persons for insert to authenticated
  with check (public.is_member() and public.photo_visible(photo_id));
create policy photo_persons_update on public.photo_persons for update to authenticated
  using (public.is_member() and public.photo_visible(photo_id))
  with check (public.is_member() and public.photo_visible(photo_id));
