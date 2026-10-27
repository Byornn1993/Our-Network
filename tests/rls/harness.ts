import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Minimale nabootsing van wat Supabase levert: auth.users, auth.uid(), de rollen en storage.
// auth.uid() leest, net als in Supabase, de 'sub' uit de JWT-claims van het request.
export const AUTH_STUB = `
create schema if not exists auth;
create table auth.users (id uuid primary key, email text);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid
$$;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
grant usage on schema public to anon, authenticated;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
`;

export const STORAGE_STUB = `
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id), name text, owner uuid default auth.uid());
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated, anon;
grant select, insert, update, delete on storage.objects to authenticated, anon;
`;

export const USER_A = 'aaaaaaaa-0000-4000-8000-00000000000a'; // eerste lid (Bjorn)
export const USER_B = 'bbbbbbbb-0000-4000-8000-00000000000b'; // uitgenodigd (Stephanie)
export const USER_C = 'cccccccc-0000-4000-8000-00000000000c'; // vreemde, nooit uitgenodigd

export async function createDb(opts: { storage?: boolean } = {}): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(AUTH_STUB);
  if (opts.storage) await db.exec(STORAGE_STUB);
  const dir = join(process.cwd(), 'supabase', 'migrations');
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(join(dir, file), 'utf8'));
  }
  await db.exec(
    `insert into auth.users (id, email) values ('${USER_A}', 'a@test.be'), ('${USER_B}', 'B@Test.be'), ('${USER_C}', 'c@test.be');`,
  );
  return db;
}

/** Voert sql uit als ingelogde gebruiker (rol authenticated + JWT-claim), binnen een transactie. */
export async function asUser<T>(db: PGlite, userId: string | null, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return (await db.transaction(async (tx) => {
    if (userId) {
      await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: userId, role: 'authenticated' })]);
      await tx.exec('set local role authenticated');
    } else {
      await tx.exec('set local role anon');
    }
    return fn(tx);
  })) as T;
}

export type Tx = Parameters<Parameters<PGlite['transaction']>[0]>[0];
