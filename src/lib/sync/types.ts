import type { SyncTable } from '@/lib/db/types';

// Outbox-wachtrij: elke lokale wijziging wordt hier eerst bewaard en daarna naar Supabase gestuurd.
export interface OutboxOp {
  seq?: number;
  /** Entiteitsleutel, bv. "persons:<uuid>". Opeenvolgende wijzigingen aan dezelfde entiteit worden samengevoegd. */
  key: string;
  table: SyncTable;
  row: Record<string, unknown>;
  /** Verhoogt bij elke samenvoeging; voorkomt dat een wijziging tijdens het versturen verloren gaat. */
  version: number;
  createdAt: string;
  attempts: number;
  lastError: string | null;
}

export interface Conflict {
  key: string;
  table: SyncTable;
  entityId: string;
  /** Lokale (nog niet verstuurde) versie. */
  local: Record<string, unknown>;
  /** Nieuwere versie op de server (van de andere persoon of een ander toestel). */
  remote: Record<string, unknown>;
  localBase: string | null;
  remoteUpdatedAt: string;
  detectedAt: string;
}

export const entityKey = (table: SyncTable, id: string) => `${table}:${id}`;
