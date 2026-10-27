import { describe, expect, it } from 'vitest';
import { createArtifactBackend, type ClaudeLike } from '@/lib/backend/artifact';
import { openDb, type OurNetworkDb } from '@/lib/db/schema';
import { buildStore } from '@/lib/db/store';
import { SYNC_TABLES } from '@/lib/db/types';
import { syncOnce } from '@/lib/sync/engine';
import { saveEvent, savePerson, type PersonInput } from '@/lib/actions';
import type { Backend } from '@/lib/backend/types';

// Nabootsing van de Artifact-database: één gedeelde opslag, meerdere kijkers.
// Zoals het platform: data/users/<id>/... is enkel zichtbaar voor die kijker.

type Data = Record<string, unknown>;

function fakePlatform() {
  const docs = new Map<string, Data>(); // volledig pad → body
  const listeners = new Set<() => void>();
  const notify = () => queueMicrotask(() => listeners.forEach((l) => l()));
  const blobs = new Map<string, Blob>();

  function viewer(uid: string, opts: { assets?: boolean; canWrite?: boolean } = {}): ClaudeLike {
    const visible = (path: string) => !path.startsWith('data/users/') || path.startsWith(`data/users/${uid}/`);
    const docRef = (path: string) => ({
      async set(data: Data) {
        if (!visible(path) || opts.canWrite === false) throw { code: 'invalid_argument', message: 'denied' };
        docs.set(path, structuredClone(data));
        notify();
      },
      async delete() {
        docs.delete(path);
        notify();
      },
      collection: (sub: string) => collRef(`${path}/${sub}`),
    });
    const collRef = (path: string) => ({
      doc: (id: string) => docRef(`${path}/${id}`),
      onSnapshot(next: (s: unknown) => void) {
        const emit = () => {
          const list = visible(`${path}/x`)
            ? [...docs.entries()].filter(([p]) => p.startsWith(`${path}/`) && !p.slice(path.length + 1).includes('/'))
            : [];
          next({
            docs: list.map(([p, d]) => ({ id: p.split('/').pop()!, exists: true, data: () => d })),
            docChanges: () => [1],
            metadata: { fromCache: false, hasPendingWrites: false },
          });
        };
        listeners.add(emit);
        queueMicrotask(emit);
        return () => listeners.delete(emit);
      },
    });
    const ns: Record<string, unknown> = {
      db: { doc: docRef, collection: collRef },
      user: { id: async () => uid, name: async () => uid, can: async () => opts.canWrite ?? true },
      assets:
        opts.assets === false
          ? null
          : {
              async upload(blob: Blob) {
                const id = `a${blobs.size}`.padEnd(32, '0');
                blobs.set(id, blob);
                return { id, url: `/_blob/${id}` };
              },
              async delete(id: string) {
                return { deleted: blobs.delete(id) };
              },
            },
      downloads: null,
    };
    return { use: async (name: string) => ns[name] ?? null };
  }
  return { viewer, docs, blobs };
}

const P1 = '00000000-0000-4000-8000-000000000001';
const KENNIS = '00000000-0000-4000-8000-000000000105';
const MEMORY = '00000000-0000-4000-8000-000000000206';
const meta = { created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z', deleted_at: null, created_by: null };

async function seed(b: Backend) {
  await b.remote.upsert('profiles', { id: P1, slot: 1, name: 'Bjorn', avatar_path: null, user_id: null, ...meta });
  await b.remote.upsert('categories', { id: KENNIS, name: 'Kennissen', description: null, color: '#8A9590', icon: 'user', ring: 4, avatar_size: 38, group_key: 'acquaintances', display_order: 5, archived_at: null, ...meta });
  await b.remote.upsert('event_categories', { id: MEMORY, system_key: 'memory', name: 'Herinnering', color: '#C9A7F5', icon: 'star', display_order: 6, archived_at: null, ...meta });
}

async function storeOf(db: OurNetworkDb) {
  const entries = await Promise.all(SYNC_TABLES.map(async (t) => [t, await db.table(t).toArray()] as const));
  return buildStore(Object.fromEntries(entries) as never);
}

const person = (first: string): PersonInput => ({
  first_name: first, last_name: null, avatar_path: null, birth_date: null, phone: null, email: null, other_contacts: [], description: null, notes: null,
  hobbies: null, interests: null, important_info: null, met_via: null, first_met_at: null, first_met_precision: 'day', added_at: '2026-10-27',
  category_id: KENNIS, ring_override: null,
});

const event = (title: string, is_private: boolean) => ({
  title, description: null, personal_note: null, event_date: '2025-05-05', date_precision: 'day' as const, event_end_date: null,
  event_category_id: MEMORY, theme: null, location: null, is_highlight: false, is_private,
});

describe('artifact-backend', () => {
  it('zonder db (niet in Claude geopend) geen backend', async () => {
    expect(await createArtifactBackend({ use: async () => null })).toBeNull();
  });

  it('Bjorn en Stephanie delen het netwerk via de sync-engine', async () => {
    const platform = fakePlatform();
    const bjorn = (await createArtifactBackend(platform.viewer('u_bjorn'), { onRemoteChange: () => {} }))!;
    const steph = (await createArtifactBackend(platform.viewer('u_steph'), { onRemoteChange: () => {} }))!;
    await seed(bjorn);

    const a = openDb(`art-a-${crypto.randomUUID()}`);
    await syncOnce(a, bjorn.remote);
    const id = await savePerson(await storeOf(a), person('Thomas'), { connections: [{ profileId: P1, description: 'collega' }] });
    const r = await syncOnce(a, bjorn.remote);
    expect(r.blockedBy).toBeNull();
    expect(await a.outbox.count()).toBe(0);
    expect(platform.docs.get(`persons/${id}`)).toMatchObject({ first_name: 'Thomas', created_by: 'u_bjorn' });

    const b = openDb(`art-b-${crypto.randomUUID()}`);
    await syncOnce(b, steph.remote);
    const sb = await storeOf(b);
    expect(sb.personById.get(id)?.first_name).toBe('Thomas');
    expect(sb.person_connections[0]?.description).toBe('collega');
    expect(sb.relationship_history).toHaveLength(1);
    expect(sb.categories.map((c) => c.name)).toEqual(['Kennissen']);
  });

  it('updated_at loopt altijd vooruit, ook als een ander toestel een voorlopende klok had', async () => {
    const platform = fakePlatform();
    const b = (await createArtifactBackend(platform.viewer('u_bjorn'), { onRemoteChange: () => {} }))!;
    const future = new Date(Date.now() + 3_600_000).toISOString();
    platform.docs.set('persons/p1', { id: 'p1', first_name: 'X', updated_at: future, created_by: 'u_steph', created_at: future });
    await b.remote.fetchSince('persons', null, 0, 499);
    const ts = await b.remote.upsert('persons', { id: 'p1', first_name: 'Y', created_at: future });
    expect(Date.parse(ts)).toBeGreaterThan(Date.parse(future));
    expect(platform.docs.get('persons/p1')).toMatchObject({ first_name: 'Y', created_by: 'u_steph' });
  });

  it('een privé-herinnering en haar koppelingen zijn onzichtbaar voor de ander; terug delen verhuist alles', async () => {
    const platform = fakePlatform();
    const bjorn = (await createArtifactBackend(platform.viewer('u_bjorn'), { onRemoteChange: () => {} }))!;
    const steph = (await createArtifactBackend(platform.viewer('u_steph'), { onRemoteChange: () => {} }))!;
    await seed(bjorn);
    const a = openDb(`art-c-${crypto.randomUUID()}`);
    await syncOnce(a, bjorn.remote);
    const pid = await savePerson(await storeOf(a), person('Lisa'), { connections: [] });
    const eid = await saveEvent(await storeOf(a), event('Geheim', true), { personIds: [pid], profileIds: [P1] });
    await syncOnce(a, bjorn.remote);

    expect(platform.docs.has(`events/${eid}`)).toBe(false);
    expect(platform.docs.has(`data/users/u_bjorn/events/rows/${eid}`)).toBe(true);
    expect([...platform.docs.keys()].filter((k) => k.startsWith('event_persons/') || k.startsWith('event_profiles/'))).toEqual([]);
    expect(await steph.remote.fetchSince('events', null, 0, 499)).toEqual([]);
    expect(await steph.remote.fetchSince('event_persons', null, 0, 499)).toEqual([]);
    // Bjorn ziet ze zelf wel
    expect((await bjorn.remote.fetchSince('events', null, 0, 499)).map((r) => r.id)).toEqual([eid]);

    // terug delen: herinnering + kinderen verhuizen naar de gedeelde collecties
    const s = await storeOf(a);
    await saveEvent(s, { ...event('Geheim', false) }, { personIds: [pid], profileIds: [P1] }, eid);
    await syncOnce(a, bjorn.remote);
    expect(platform.docs.has(`events/${eid}`)).toBe(true);
    expect(platform.docs.has(`data/users/u_bjorn/events/rows/${eid}`)).toBe(false);
    expect((await steph.remote.fetchSince('event_persons', null, 0, 499)).map((r) => r.person_id)).toEqual([pid]);
  });

  it("foto's: asset-id als sleutel, tonen via /_blob/; zonder uploadrechten een duidelijke fout", async () => {
    const platform = fakePlatform();
    const b = (await createArtifactBackend(platform.viewer('u_bjorn'), { onRemoteChange: () => {} }))!;
    const key = await b.storage.upload('events/x/y.jpg', new Blob(['x'], { type: 'image/jpeg' }));
    expect(key).toHaveLength(32);
    expect(await b.storage.signedUrls([key])).toEqual({ [key]: `/_blob/${key}` });
    expect(b.permissions).toEqual({ canWrite: true, canUpload: true });

    const viewer = (await createArtifactBackend(platform.viewer('u_view', { assets: false, canWrite: false }), { onRemoteChange: () => {} }))!;
    expect(viewer.permissions).toEqual({ canWrite: false, canUpload: false });
    await expect(viewer.storage.upload('x', new Blob(['x']))).rejects.toThrow(/Editor/);
    await expect(viewer.remote.upsert('persons', { id: 'p9', first_name: 'Z' })).rejects.toThrow(/schrijfrechten/);
  });
});
