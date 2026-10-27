import Dexie, { type Table } from 'dexie';
import { SYNC_TABLES, type RowTypes, type SyncTable } from './types';
import type { Conflict, OutboxOp } from '@/lib/sync/types';

export interface MetaRow {
  key: string;
  value: unknown;
}

type Tables = { [K in SyncTable]: Table<RowTypes[K], string> };

/**
 * Lokale database per gebruiker. Alles wat de UI toont komt hieruit (local-first);
 * Supabase is de bron van waarheid en wordt via de outbox/sync bijgewerkt.
 *
 * Belangrijk (iOS Safari): geen IndexedDB-cursors gebruiken (orderBy/first/reverse/uniqueKeys).
 * Lees altijd met toArray()/get() en sorteer in JavaScript.
 */
export interface OurNetworkDb extends Dexie, Tables {
  outbox: Table<OutboxOp, number>;
  conflicts: Table<Conflict, string>;
  meta: Table<MetaRow, string>;
}

export function createDb(name: string): OurNetworkDb {
  const db = new Dexie(name) as OurNetworkDb;
  const stores: Record<string, string> = { outbox: '++seq, key', conflicts: 'key', meta: 'key' };
  for (const t of SYNC_TABLES) stores[t] = 'id';
  db.version(1).stores(stores);
  return db;
}

let current: OurNetworkDb | null = null;

export const dbName = (userId: string) => `ournetwork-${userId}`;

export function openDb(userId: string): OurNetworkDb {
  if (current?.name === dbName(userId)) return current;
  current?.close();
  current = createDb(dbName(userId));
  return current;
}

export function closeDb(): void {
  current?.close();
  current = null;
}

export function getDb(): OurNetworkDb {
  if (!current) throw new Error('Geen lokale database open (niet ingelogd).');
  return current;
}

/** Verwijdert de lokale kopie van deze gebruiker volledig (bij uitloggen of opnieuw opbouwen). */
export async function deleteLocalDb(userId: string): Promise<void> {
  if (current?.name === dbName(userId)) closeDb();
  await Dexie.delete(dbName(userId));
}
