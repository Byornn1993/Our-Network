import { v4, v5 } from 'uuid';
import { getDb } from './schema';
import type { RowTypes, SyncTable } from './types';
import { enqueue } from '@/lib/sync/outbox';
import { notifyLocalChange } from '@/lib/sync/scheduler';

// Schrijflaag: elke wijziging gaat in één transactie naar de lokale database ÉN de outbox.
// Verwijderen = deleted_at zetten (soft delete); de server laat geen echte deletes toe.

export const newId = (): string => v4();

const LINK_NS = '6f1d2c3b-8a4e-4f7a-9c0d-5b2e1a7c3d90';
/**
 * Deterministische id voor koppelrijen (event ↔ persoon, persoon ↔ profiel, …).
 * Twee toestellen die offline dezelfde koppeling maken, komen zo op dezelfde rij uit.
 */
export const linkId = (...parts: string[]): string => v5(parts.join('|'), LINK_NS);

export type Patch<T extends SyncTable> = Partial<RowTypes[T]> & { id: string };

export interface Change<T extends SyncTable = SyncTable> {
  table: T;
  row: Patch<T>;
}

export const change = <T extends SyncTable>(table: T, row: Patch<T>): Change => ({ table, row }) as Change;

export async function write(changes: Change[]): Promise<void> {
  if (!changes.length) return;
  const db = getDb();
  const tables = [...new Set(changes.map((c) => c.table))].map((t) => db.table(t));
  const now = new Date().toISOString();
  await db.transaction('rw', [...tables, db.outbox], async () => {
    for (const c of changes) {
      const t = db.table(c.table);
      const existing = (await t.get(c.row.id)) as Record<string, unknown> | undefined;
      const merged = { ...(existing ?? { created_at: now, deleted_at: null, _base: null }), ...c.row, updated_at: now };
      await t.put(merged);
      await enqueue(db, c.table, merged);
    }
  });
  notifyLocalChange();
}

export const softDelete = <T extends SyncTable>(table: T, id: string): Change => change(table, { id, deleted_at: new Date().toISOString() } as Patch<T>);

/**
 * Koppelingen gelijkzetten: voor elke gewenste sleutel een (eventueel heropende) rij,
 * bestaande rijen die niet meer gewenst zijn worden soft-deleted.
 */
export function syncLinks<T extends 'event_persons' | 'event_profiles' | 'person_connections' | 'photo_persons'>(
  table: T,
  existing: RowTypes[T][],
  owner: { field: string; id: string },
  other: { field: string },
  wanted: string[],
  extra: (otherId: string) => Partial<RowTypes[T]> = () => ({}),
): Change[] {
  const out: Change[] = [];
  const mine = existing.filter((r) => (r as unknown as Record<string, string>)[owner.field] === owner.id);
  const wantedSet = new Set(wanted);
  for (const r of mine) {
    const otherId = (r as unknown as Record<string, string>)[other.field]!;
    if (!wantedSet.has(otherId) && !r.deleted_at) out.push(softDelete(table, r.id));
  }
  for (const otherId of wanted) {
    const id = linkId(table, owner.id, otherId);
    const cur = mine.find((r) => r.id === id);
    const ex = extra(otherId);
    const changed = !cur || cur.deleted_at || Object.entries(ex).some(([k, v]) => (cur as unknown as Record<string, unknown>)[k] !== v);
    if (changed) out.push(change(table, { id, [owner.field]: owner.id, [other.field]: otherId, deleted_at: null, ...ex } as Patch<T>));
  }
  return out;
}
