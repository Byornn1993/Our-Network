import type { OurNetworkDb } from '@/lib/db/schema';
import { SYNC_TABLES, type SyncTable } from '@/lib/db/types';
import { ack, pendingKeys } from './outbox';
import { entityKey, type Conflict, type OutboxOp } from './types';

// Sync-engine (zelfde principe als Be Strong, maar generiek: lokale rijen = serverrijen).
//  1. PULL: per tabel de rijen ophalen die sinds de laatste cursor veranderden (incl. soft deletes).
//     - Geen lokale wijziging in de wachtrij → serverversie overnemen.
//     - Wel een lokale wijziging én de server veranderde sinds onze basisversie → CONFLICT.
//       Nooit stilzwijgend overschrijven; de gebruiker kiest in Instellingen › Synchronisatie.
//  2. PUSH: de wachtrij in volgorde versturen met idempotente upserts. Stopt bij de eerste fout,
//     zodat afhankelijke wijzigingen (persoon → koppeling) nooit in de verkeerde volgorde aankomen.

export class RemoteError extends Error {
  constructor(
    message: string,
    readonly network: boolean,
  ) {
    super(message);
  }
}

export interface RemoteApi {
  /** Upsert op id; geeft de nieuwe server-updated_at terug. */
  upsert(table: SyncTable, row: Record<string, unknown>): Promise<string>;
  /** Rijen met updated_at > since, gesorteerd op (updated_at, id), pagina [from, to]. */
  fetchSince(table: SyncTable, since: string | null, from: number, to: number): Promise<Record<string, unknown>[]>;
}

const PAGE = 500;
// Kleine overlap: rijen die net vóór onze cursor gecommit werden, worden zo niet gemist.
const OVERLAP_MS = 60_000;

export function sameTimestamp(a: string | null | undefined, b: string | null | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return Date.parse(a) === Date.parse(b);
}

export interface SyncResult {
  pulled: number;
  pushed: number;
  conflicts: number;
  blockedBy: OutboxOp | null;
}

export async function pull(db: OurNetworkDb, api: RemoteApi): Promise<{ pulled: number; conflicts: number }> {
  let pulled = 0;
  let conflicts = 0;
  for (const table of SYNC_TABLES) {
    const cursorKey = `cursor:${table}`;
    const stored = ((await db.meta.get(cursorKey))?.value as string | undefined) ?? null;
    // Een cursor in de toekomst (verkeerde klok of tijdstempel) zou wijzigingen overslaan: dan alles opnieuw ophalen.
    const cursor = stored && Date.parse(stored) <= Date.now() + OVERLAP_MS ? stored : null;
    const since = cursor ? new Date(Date.parse(cursor) - OVERLAP_MS).toISOString() : null;
    let maxSeen = cursor;
    for (let from = 0; ; from += PAGE) {
      const rows = await api.fetchSince(table, since, from, from + PAGE - 1);
      const pending = await pendingKeys(db);
      const t = db.table(table);
      await db.transaction('rw', [t, db.conflicts], async () => {
        for (const row of rows) {
          const id = row.id as string;
          const updatedAt = row.updated_at as string;
          const key = entityKey(table, id);
          const local = (await t.get(id)) as Record<string, unknown> | undefined;
          if (pending.has(key)) {
            if (local && !sameTimestamp(local._base as string | null, updatedAt)) {
              const c: Conflict = {
                key,
                table,
                entityId: id,
                local,
                remote: row,
                localBase: (local._base as string | null) ?? null,
                remoteUpdatedAt: updatedAt,
                detectedAt: new Date().toISOString(),
              };
              await db.conflicts.put(c);
              conflicts++;
            }
            continue;
          }
          // Ook bij een gelijke versie overnemen: zo komen server-velden (created_by) lokaal binnen.
          await t.put({ ...row, _base: updatedAt });
          pulled++;
        }
      });
      for (const row of rows) {
        const u = row.updated_at as string;
        if (!maxSeen || Date.parse(u) > Date.parse(maxSeen)) maxSeen = u;
      }
      if (rows.length < PAGE) break;
    }
    if (maxSeen !== cursor) await db.meta.put({ key: cursorKey, value: maxSeen });
  }
  return { pulled, conflicts };
}

export async function push(db: OurNetworkDb, api: RemoteApi): Promise<{ pushed: number; blockedBy: OutboxOp | null }> {
  let pushed = 0;
  const conflicted = new Set((await db.conflicts.toArray()).map((c) => c.key));
  const ops = (await db.outbox.toArray()).sort((a, b) => a.seq! - b.seq!);
  for (const op of ops) {
    // Een entiteit in conflict wacht op de keuze van de gebruiker. Alles daarna ook,
    // want latere operaties kunnen ervan afhangen.
    if (conflicted.has(op.key)) return { pushed, blockedBy: op };
    try {
      const updatedAt = await api.upsert(op.table, op.row);
      const acked = await ack(db, op);
      // Alleen als er intussen niets nieuws lokaal gewijzigd werd, is de lokale rij gelijk aan de server.
      if (acked) await db.table(op.table).update(op.row.id as string, { _base: updatedAt, updated_at: updatedAt });
      else await db.table(op.table).update(op.row.id as string, { _base: updatedAt });
      pushed++;
    } catch (e) {
      const err = e instanceof RemoteError ? e : new RemoteError(e instanceof Error ? e.message : String(e), false);
      if (!err.network) await db.outbox.update(op.seq!, { attempts: op.attempts + 1, lastError: err.message });
      throw err;
    }
  }
  return { pushed, blockedBy: null };
}

export async function syncOnce(db: OurNetworkDb, api: RemoteApi): Promise<SyncResult> {
  const p = await pull(db, api);
  const q = await push(db, api);
  return { pulled: p.pulled, conflicts: p.conflicts, pushed: q.pushed, blockedBy: q.blockedBy };
}

/** Conflict oplossen: eigen versie houden (wordt opnieuw verstuurd) of serverversie nemen. */
export async function resolveConflict(db: OurNetworkDb, key: string, choice: 'mine' | 'server'): Promise<void> {
  const c = await db.conflicts.get(key);
  if (!c) return;
  const table = db.table(c.table);
  await db.transaction('rw', [table, db.conflicts, db.outbox], async () => {
    if (choice === 'server') {
      await table.put({ ...c.remote, _base: c.remoteUpdatedAt });
      await db.outbox.bulkDelete((await db.outbox.toArray()).filter((o) => o.key === key).map((o) => o.seq!));
    } else {
      // Onze versie wordt nu gebaseerd op de laatste serverversie en overschrijft die bij de volgende push.
      await table.update(c.entityId, { _base: c.remoteUpdatedAt });
    }
    await db.conflicts.delete(key);
  });
}
