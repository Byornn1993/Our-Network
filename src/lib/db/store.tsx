import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getDb } from './schema';
import { SYNC_TABLES, type RowTypes, type SyncTable } from './types';
import { Spinner } from '@/components/ui/States';

// Eén gedeelde, live bijgewerkte kijk op alle lokale data. Het netwerk is klein (honderden rijen),
// dus alles in het geheugen houden is snel en maakt kruisverwijzingen (persoon ↔ gebeurtenis) eenvoudig.
// Lezen met toArray (geen IndexedDB-cursors: iOS Safari).

type All = { [K in SyncTable]: RowTypes[K][] };

export interface Store extends All {
  /** Inclusief soft-deleted rijen: om oude verwijzingen (bv. in een gebeurtenis) nog te kunnen tonen. */
  raw: All;
  personById: Map<string, RowTypes['persons']>;
  categoryById: Map<string, RowTypes['categories']>;
  eventCategoryById: Map<string, RowTypes['event_categories']>;
  profileById: Map<string, RowTypes['profiles']>;
  eventById: Map<string, RowTypes['events']>;
}

const StoreContext = createContext<Store | null>(null);

const byOrder = (a: { display_order: number; name: string }, b: { display_order: number; name: string }) =>
  a.display_order - b.display_order || a.name.localeCompare(b.name);

export function buildStore(raw: All): Store {
  const alive = Object.fromEntries(SYNC_TABLES.map((t) => [t, (raw[t] as { deleted_at: string | null }[]).filter((r) => !r.deleted_at)])) as All;
  alive.categories.sort(byOrder);
  alive.event_categories.sort(byOrder);
  alive.profiles.sort((a, b) => a.slot - b.slot);
  return {
    ...alive,
    raw,
    personById: new Map(raw.persons.map((p) => [p.id, p])),
    categoryById: new Map(raw.categories.map((c) => [c.id, c])),
    eventCategoryById: new Map(raw.event_categories.map((c) => [c.id, c])),
    profileById: new Map(raw.profiles.map((p) => [p.id, p])),
    eventById: new Map(alive.events.map((e) => [e.id, e])),
  };
}

export function DataProvider({ children }: { children: ReactNode }) {
  const raw = useLiveQuery(async () => {
    const db = getDb();
    const entries = await Promise.all(SYNC_TABLES.map(async (t) => [t, await db.table(t).toArray()] as const));
    return Object.fromEntries(entries) as All;
  }, []);
  const store = useMemo(() => (raw ? buildStore(raw) : null), [raw]);
  if (!store) return <Spinner label="Gegevens openen…" />;
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error('useStore buiten DataProvider');
  return s;
}

export function useOutboxCount(): number | undefined {
  return useLiveQuery(() => getDb().outbox.count(), []);
}

export function useOutbox() {
  return useLiveQuery(async () => (await getDb().outbox.toArray()).sort((a, b) => a.seq! - b.seq!), []);
}

export function useConflicts() {
  return useLiveQuery(() => getDb().conflicts.toArray(), []);
}
