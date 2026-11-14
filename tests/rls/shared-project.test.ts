import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { AUTH_STUB, STORAGE_STUB } from './harness';

// Our Network is een gast-app in het Supabase-project van Be Strong, naast Boodschappenlijst.
// Deze test bootst beide apps na (tabellen, functies, policies, trigger, rechten, bucket), installeert
// Our Network en controleert dat er aan hun kant NIETS veranderde en dat alles van ons net_ heet.

const OTHER_APPS = `
-- Be Strong (eigenaar, geen prefix)
create table public.profiles (id uuid primary key, display_name text, updated_at timestamptz default now());
create table public.workouts (id uuid primary key, user_id uuid, name text);
create or replace function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at := now(); return new; end; $$;
create or replace function public.handle_new_user() returns trigger language plpgsql security definer as $$ begin insert into public.profiles (id) values (new.id); return new; end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
create trigger set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
alter table public.profiles enable row level security;
alter table public.workouts enable row level security;
create policy profiles_select on public.profiles for select to authenticated using (id = auth.uid());
create policy workouts_select on public.workouts for select to authenticated using (user_id = auth.uid());
grant select, insert, update, delete on public.profiles, public.workouts to authenticated;
grant select on public.profiles to anon;
create index workouts_user_idx on public.workouts (user_id);

-- Boodschappenlijst (prefix lists_)
create table public.lists_items (id uuid primary key, user_id uuid, name text);
alter table public.lists_items enable row level security;
create policy lists_items_select on public.lists_items for select to authenticated using (user_id = auth.uid());
grant select, insert, update, delete on public.lists_items to authenticated;
create or replace function public.lists_set_updated_at() returns trigger language plpgsql as $$ begin return new; end; $$;

insert into storage.buckets (id, name, public) values ('bestrong', 'bestrong', false);
`;

// Alles wat een migratie zou kunnen raken, als vergelijkbare tekst.
const SNAPSHOT = `
select 'table:' || c.relname || ':rls=' || c.relrowsecurity as x from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r'
union all select 'index:' || indexname from pg_indexes where schemaname = 'public'
union all select 'policy:' || tablename || '.' || policyname || ':' || cmd || ':' || coalesce(qual, '') from pg_policies where schemaname = 'public'
union all select 'storagepolicy:' || policyname from pg_policies where schemaname = 'storage'
union all select 'function:' || p.proname || ':' || md5(p.prosrc) || ':' || coalesce(array_to_string(p.proacl, ','), 'default') from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
union all select 'trigger:' || c.relname || '.' || t.tgname from pg_trigger t join pg_class c on c.oid = t.tgrelid where not t.tgisinternal
union all select 'grant:' || table_name || ':' || grantee || ':' || privilege_type from information_schema.role_table_grants where table_schema = 'public' and grantee in ('anon', 'authenticated', 'PUBLIC')
union all select 'bucket:' || id || ':' || public from storage.buckets
order by 1`;

async function snapshot(db: PGlite): Promise<string[]> {
  return (await db.query<{ x: string }>(SNAPSHOT)).rows.map((r) => r.x);
}

/** Naam van het object uit een snapshot-regel, bv. "policy:lists_items.lists_items_select:…" → "lists_items_select". */
function objectName(line: string): string {
  const [kind, rest] = [line.slice(0, line.indexOf(':')), line.slice(line.indexOf(':') + 1)];
  if (kind === 'policy' || kind === 'trigger') return rest.split(':')[0]!.split('.')[1]!;
  if (kind === 'grant') return rest.split(':')[0]!;
  return rest.split(':')[0]!;
}

it('installeren laat Be Strong en Boodschappenlijst ongemoeid; alles van Our Network heet net_', async () => {
  const db = new PGlite();
  await db.exec(AUTH_STUB);
  await db.exec(STORAGE_STUB);
  await db.exec(OTHER_APPS);
  const before = await snapshot(db);

  await db.exec(readFileSync('supabase/setup-productie.sql', 'utf8'));
  const after = await snapshot(db);

  // 1. Elke regel van de andere apps staat er nog, identiek (zelfde rechten, policies, functiecode, triggers).
  for (const line of before) expect(after, `gewijzigd of verdwenen: ${line}`).toContain(line);

  // 2. Alles wat erbij kwam, is van Our Network (prefix net_ / net-).
  const added = after.filter((l) => !before.includes(l));
  expect(added.length).toBeGreaterThan(40);
  for (const line of added) expect(objectName(line), line).toMatch(/^net[_-]/);

  // 3. De Be Strong-trigger op auth.users werkt nog (nieuwe gebruiker → Be Strong-profiel), en Our Network
  //    maakt bij een nieuwe gebruiker niets aan.
  await db.exec(`insert into auth.users (id, email) values ('dddddddd-0000-4000-8000-00000000000d', 'nieuw@test.be')`);
  const bs = await db.query<{ n: number }>(`select count(*)::int as n from public.profiles where id = 'dddddddd-0000-4000-8000-00000000000d'`);
  const on = await db.query<{ n: number }>(`select count(*)::int as n from public.net_members`);
  expect(bs.rows[0]!.n).toBe(1);
  expect(on.rows[0]!.n).toBe(0);
});
