import type { OurNetworkDb } from '@/lib/db/schema';
import type { SyncTable } from '@/lib/db/types';
import { entityKey, type OutboxOp } from './types';

/** Wat er naar de server gaat: alles behalve de velden die de server zelf beheert. */
export function toPayload(row: Record<string, unknown>): Record<string, unknown> {
  const { _base: _b, updated_at: _u, created_by: _c, ...rest } = row;
  return rest;
}

/**
 * Zet een wijziging in de wachtrij. Bestaat er al een openstaande wijziging voor dezelfde entiteit,
 * dan wordt die IN PLAATS bijgewerkt (zelfde volgnummer). Zo blijft de volgorde tussen afhankelijke
 * entiteiten behouden (eerst de persoon, dan de koppeling) en groeit de wachtrij niet.
 * Moet binnen een Dexie-transactie op `db.outbox` aangeroepen worden (samen met de lokale wijziging).
 */
export async function enqueue(db: OurNetworkDb, table: SyncTable, row: Record<string, unknown>): Promise<void> {
  const key = entityKey(table, row.id as string);
  // Bewust zonder IndexedDB-cursors: iOS Safari geeft daar soms "Unable to open cursor".
  const existing = (await db.outbox.toArray()).find((o) => o.key === key);
  const payload = toPayload(row);
  if (existing?.seq !== undefined) {
    await db.outbox.put({ ...existing, row: payload, version: existing.version + 1, lastError: null });
    return;
  }
  await db.outbox.add({ key, table, row: payload, version: 1, createdAt: new Date().toISOString(), attempts: 0, lastError: null });
}

/** Verwijdert een verstuurde operatie, maar alleen als ze intussen niet opnieuw gewijzigd werd. */
export async function ack(db: OurNetworkDb, op: OutboxOp): Promise<boolean> {
  return db.transaction('rw', db.outbox, async () => {
    const cur = await db.outbox.get(op.seq!);
    if (cur && cur.version === op.version) {
      await db.outbox.delete(op.seq!);
      return true;
    }
    return false;
  });
}

export async function pendingKeys(db: OurNetworkDb): Promise<Set<string>> {
  return new Set((await db.outbox.toArray()).map((o) => o.key));
}
