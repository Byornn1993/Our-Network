import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { AUTH_STUB, STORAGE_STUB } from './harness';

it('supabase/setup-productie.sql installeert de volledige database in één keer (incl. storage)', async () => {
  const db = new PGlite();
  await db.exec(AUTH_STUB);
  await db.exec(STORAGE_STUB);
  await db.exec(readFileSync('supabase/setup-productie.sql', 'utf8'));
  const rls = await db.query<{ n: number }>(`select count(*)::int as n from pg_tables where schemaname = 'public' and rowsecurity`);
  const notRls = await db.query<{ n: number }>(`select count(*)::int as n from pg_tables where schemaname = 'public' and not rowsecurity`);
  const policies = await db.query<{ n: number }>(`select count(*)::int as n from pg_policies where schemaname = 'storage'`);
  expect(rls.rows[0]!.n).toBe(16);
  expect(notRls.rows[0]!.n).toBe(0);
  expect(policies.rows[0]!.n).toBe(4);
});
