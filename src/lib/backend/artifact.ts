import { RemoteError, type RemoteApi } from '@/lib/sync/engine';
import { requestSync } from '@/lib/sync/scheduler';
import { SYNC_TABLES, type SyncTable } from '@/lib/db/types';
import type { AuthUser, Backend } from './types';

// Backend voor de claude.ai-Artifact (build: `vite build --mode artifact`).
//  * db      — gedeelde documenten, één collectie per tabel (document-id = rij-id), live via onSnapshot.
//              Privé-herinneringen en alles wat eraan hangt staan onder data/users/<id>/<tabel>/rows/<id>:
//              die map is per persoon afgeschermd door het platform, ook voor de eigenaar.
//  * user    — wie de pagina bekijkt (vervangt inloggen).
//  * assets  — foto's; het asset-id komt in avatar_path/storage_path/thumb_path, tonen via /_blob/<id>.
//  * downloads — back-up en CSV aanbieden.
// De lokale database, outbox en conflictafhandeling van de app blijven ongewijzigd.

// ── minimale vormen van de platform-API (zie de .d.ts van de artifact-capabilities) ──
interface DocSnap {
  id: string;
  exists: boolean;
  data(): Record<string, unknown> | undefined;
}
interface QuerySnap {
  docs: DocSnap[];
  docChanges(): unknown[];
  metadata: { fromCache: boolean; hasPendingWrites: boolean };
}
interface DocRef {
  set(data: Record<string, unknown>): Promise<void>;
  delete(): Promise<void>;
  collection(path: string): CollRef;
}
interface CollRef {
  doc(id: string): DocRef;
  onSnapshot(next: (s: QuerySnap) => void, error?: (e: { code: string; message: string }) => void): () => void;
}
export interface ArtifactDb {
  doc(path: string): DocRef;
  collection(path: string): CollRef;
}
export interface ArtifactUser {
  id(): Promise<string | null>;
  name(): Promise<string>;
  can(name: string): Promise<boolean | null>;
}
export interface ArtifactAssets {
  upload(blob: Blob, options?: { type?: string }): Promise<{ id: string; url: string }>;
  delete(ref: string): Promise<{ deleted: boolean }>;
}
export interface ArtifactDownloads {
  save(req: { filename: string; data: string | Blob }): Promise<{ status: string }>;
}
export interface ClaudeLike {
  use(name: string): Promise<unknown>;
}

type Row = Record<string, unknown> & { id: string; updated_at: string };

/** Tabellen die bij een privé-herinnering horen en dus ook privé kunnen zijn. */
const PRIVATE_CAPABLE = new Set<SyncTable>(['events', 'event_persons', 'event_profiles', 'event_photos', 'photo_persons']);
const EVENT_CHILDREN: SyncTable[] = ['event_persons', 'event_profiles', 'event_photos'];
// Overlap tegen klokverschillen tussen toestellen (updated_at wordt door de toestellen zelf gezet).
const CLOCK_OVERLAP_MS = 10 * 60_000;
const FIRST_SNAPSHOT_TIMEOUT_MS = 12_000;

interface Cache {
  rows: Map<string, Row>;
  ready: Promise<void>;
  error: RemoteError | null;
}

function toRemoteError(e: unknown): RemoteError {
  const code = (e as { code?: string })?.code;
  const msg = (e as { message?: string })?.message ?? String(e);
  if (code === 'invalid_argument') return new RemoteError('Geen schrijfrechten op deze artifact (vraag om Editor-toegang), of ongeldige gegevens.', false);
  if (code === 'quota_exceeded') return new RemoteError('De opslag van de artifact is vol.', false);
  return new RemoteError(msg, code === 'unavailable' || code === 'resource_exhausted' || (typeof navigator !== 'undefined' && !navigator.onLine));
}

let lastTs = 0;
/** Monotone tijd, altijd later dan de huidige versie van het document. */
function nextTimestamp(after?: unknown): string {
  const floor = typeof after === 'string' ? Date.parse(after) + 1 : 0;
  lastTs = Math.max(Date.now(), lastTs + 1, floor);
  return new Date(lastTs).toISOString();
}

export interface ArtifactBackendOptions {
  /** Lokale rij opzoeken (om te weten of een koppeling bij een privé-herinnering hoort). */
  localRow?: (table: SyncTable, id: string) => Promise<Record<string, unknown> | undefined>;
  /** Wordt aangeroepen als de ander iets wijzigde (standaard: meteen synchroniseren). */
  onRemoteChange?: () => void;
}

export async function createArtifactBackend(claude: ClaudeLike, opts: ArtifactBackendOptions = {}): Promise<Backend | null> {
  const [db, user, assets, downloads] = (await Promise.all(['db', 'user', 'assets', 'downloads'].map((n) => claude.use(n).catch(() => null)))) as [
    ArtifactDb | null,
    ArtifactUser | null,
    ArtifactAssets | null,
    ArtifactDownloads | null,
  ];
  if (!db) return null;
  const uid = (await user?.id()) ?? null;
  const name = (await user?.name()) ?? '';
  const canWrite = (await user?.can('data.write')) ?? null;
  const onRemoteChange = opts.onRemoteChange ?? (() => requestSync(400));

  const caches = new Map<string, Cache>();
  const ref = (table: SyncTable, priv: boolean): CollRef => (priv ? db.doc(`data/users/${uid}/${table}`).collection('rows') : db.collection(table));
  const key = (table: SyncTable, priv: boolean) => `${priv ? 'p' : 's'}:${table}`;

  function subscribe(table: SyncTable, priv: boolean): Cache {
    const k = key(table, priv);
    const existing = caches.get(k);
    if (existing) return existing;
    let resolve!: () => void;
    const cache: Cache = { rows: new Map(), ready: new Promise<void>((r) => (resolve = r)), error: null };
    caches.set(k, cache);
    let first = true;
    const timer = setTimeout(resolve, FIRST_SNAPSHOT_TIMEOUT_MS);
    ref(table, priv).onSnapshot(
      (snap) => {
        cache.rows = new Map(snap.docs.filter((d) => d.exists).map((d) => [d.id, { ...(d.data() as Row), id: d.id }]));
        if (!snap.metadata.fromCache) {
          clearTimeout(timer);
          resolve();
        }
        // Een wijziging van de ander (of een ander toestel): meteen ophalen.
        if (!first && !snap.metadata.hasPendingWrites && snap.docChanges().length > 0) onRemoteChange();
        first = false;
      },
      (e) => {
        cache.error = toRemoteError(e);
        clearTimeout(timer);
        resolve();
        caches.delete(k); // volgende aanroep abonneert opnieuw
      },
    );
    return cache;
  }

  const scopes = (table: SyncTable): boolean[] => (PRIVATE_CAPABLE.has(table) && uid ? [false, true] : [false]);
  const start = () => SYNC_TABLES.forEach((t) => scopes(t).forEach((p) => subscribe(t, p)));

  const localRow = opts.localRow ?? (async () => undefined);
  async function findRow(table: SyncTable, id: string): Promise<{ row: Record<string, unknown>; priv: boolean | null } | undefined> {
    for (const p of scopes(table)) {
      const r = subscribe(table, p).rows.get(id);
      if (r) return { row: r, priv: p };
    }
    const l = await localRow(table, id);
    return l ? { row: l, priv: null } : undefined;
  }
  async function eventIsPrivate(eventId: unknown): Promise<boolean> {
    if (typeof eventId !== 'string' || !uid) return false;
    const f = await findRow('events', eventId);
    return f ? (f.priv ?? !!f.row.is_private) : false;
  }
  async function isPrivate(table: SyncTable, row: Record<string, unknown>): Promise<boolean> {
    if (!uid || !PRIVATE_CAPABLE.has(table)) return false;
    if (table === 'events') return !!row.is_private;
    if (table === 'photo_persons') {
      const photo = await findRow('event_photos', row.photo_id as string);
      return eventIsPrivate(photo?.row.event_id);
    }
    return eventIsPrivate(row.event_id);
  }

  /** Schrijft een rij naar de juiste plek en ruimt een eventuele kopie op de andere plek op. */
  async function put(table: SyncTable, row: Record<string, unknown>, priv: boolean, keepTimestamp = false): Promise<string> {
    const id = row.id as string;
    const target = subscribe(table, priv);
    const other = scopes(table).length > 1 ? subscribe(table, !priv) : null;
    const prev = target.rows.get(id) ?? other?.rows.get(id);
    const updated_at = keepTimestamp && typeof row.updated_at === 'string' ? nextTimestamp(row.updated_at) : nextTimestamp(prev?.updated_at);
    const body = JSON.parse(
      JSON.stringify({
        ...row,
        created_at: prev?.created_at ?? row.created_at ?? new Date().toISOString(),
        created_by: prev?.created_by ?? uid,
        updated_at,
        _base: undefined,
      }),
    ) as Row;
    try {
      await ref(table, priv).doc(id).set(body);
      target.rows.set(id, body);
      if (other?.rows.has(id)) {
        await ref(table, !priv).doc(id).delete();
        other.rows.delete(id);
      }
    } catch (e) {
      throw toRemoteError(e);
    }
    return updated_at;
  }

  /** Een herinnering werd privé of terug gedeeld: alle kinderen verhuizen mee. */
  async function moveChildren(eventId: string, toPrivate: boolean): Promise<void> {
    const movedPhotos = new Set<string>();
    for (const t of EVENT_CHILDREN) {
      for (const r of [...subscribe(t, !toPrivate).rows.values()]) {
        if (r.event_id !== eventId) continue;
        await put(t, r, toPrivate, true);
        if (t === 'event_photos') movedPhotos.add(r.id);
      }
    }
    for (const r of [...subscribe('photo_persons', !toPrivate).rows.values()]) if (movedPhotos.has(r.photo_id as string)) await put('photo_persons', r, toPrivate, true);
  }

  const remote: RemoteApi = {
    async upsert(table, row) {
      start();
      await Promise.all(scopes(table).map((p) => subscribe(table, p).ready));
      const priv = await isPrivate(table, row);
      const wasElsewhere = table === 'events' && uid ? subscribe('events', !priv).rows.has(row.id as string) : false;
      const updatedAt = await put(table, row, priv);
      if (wasElsewhere) await moveChildren(row.id as string, priv);
      return updatedAt;
    },
    async fetchSince(table, since, from) {
      start();
      if (from > 0) return []; // alles komt in één keer uit de live cache
      const all: Row[] = [];
      for (const p of scopes(table)) {
        const c = subscribe(table, p);
        await c.ready;
        if (c.error) throw c.error;
        all.push(...c.rows.values());
      }
      const min = since ? Date.parse(since) - CLOCK_OVERLAP_MS : -Infinity;
      return all
        .filter((r) => typeof r.updated_at === 'string' && Date.parse(r.updated_at) > min)
        .sort((a, b) => a.updated_at.localeCompare(b.updated_at) || a.id.localeCompare(b.id));
    },
  };

  const me: AuthUser | null = uid ? { id: uid, email: '', name } : null;

  return {
    kind: 'artifact',
    permissions: { canWrite, canUpload: !!assets },
    auth: {
      async getUser() {
        return me;
      },
      onChange() {
        return () => {};
      },
      async signIn() {
        throw new Error('Inloggen gebeurt via Claude.');
      },
      async signOut() {},
      async sendResetLink() {},
      async updatePassword() {},
    },
    // Toegang = wie de artifact gedeeld krijgt; het platform dwingt lees- en schrijfrechten af.
    async claimMembership() {
      return true;
    },
    members: {
      async list() {
        return [];
      },
      async invites() {
        return [];
      },
      async invite() {
        throw new Error('Deel de artifact via het deelmenu van Claude.');
      },
      async revokeInvite() {},
    },
    remote,
    storage: {
      async upload(_path, blob) {
        if (!assets) throw new Error('Foto’s uploaden kan alleen met bewerkrechten (Editor) op deze artifact.');
        try {
          const r = await assets.upload(blob, { type: blob.type || 'image/jpeg' });
          return r.id;
        } catch (e) {
          const code = (e as { code?: string })?.code;
          throw new Error(
            code === 'too_large' ? 'Deze foto is te groot.' : code === 'quota_or_state' ? 'De foto-opslag van de artifact is vol.' : `Uploaden mislukt (${code ?? String(e)}).`,
          );
        }
      },
      async remove(ids) {
        if (!assets) return;
        for (const id of ids) await assets.delete(id).catch(() => {});
      },
      async signedUrls(ids) {
        return Object.fromEntries(ids.map((id) => [id, `/_blob/${id}`]));
      },
    },
    saveFile: downloads
      ? async (filename, data) => {
          await downloads.save({ filename, data });
        }
      : undefined,
  };
}
