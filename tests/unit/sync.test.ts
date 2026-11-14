import { describe, expect, it, vi } from 'vitest';
import { openDb, type OurNetworkDb } from '@/lib/db/schema';
import { buildStore, type Store } from '@/lib/db/store';
import { SYNC_TABLES, type SyncTable } from '@/lib/db/types';
import { change, write } from '@/lib/db/repo';
import { RemoteError, resolveConflict, syncOnce, type RemoteApi } from '@/lib/sync/engine';
import { archivePerson, deletePerson, firstMeetingOf, saveEvent, savePerson, type PersonInput } from '@/lib/actions';
import { buildBackup, importBackup } from '@/lib/backup';

// Nep-opslag voor foto's bij het importeren van een back-up mét foto's.
const uploads = vi.hoisted(() => [] as { path: string; size: number }[]);
vi.mock('@/lib/backend', async (orig) => ({
  ...(await orig<typeof import('@/lib/backend')>()),
  getBackend: () => ({
    storage: {
      upload: async (path: string, blob: Blob) => (uploads.push({ path, size: blob.size }), path),
      signedUrls: async () => ({}),
      remove: async () => {},
    },
  }),
}));

// Twee "toestellen" (Bjorn en Stephanie) met elk een eigen lokale database, één gedeelde nep-server.

const P1 = '00000000-0000-4000-8000-000000000001';
const P2 = '00000000-0000-4000-8000-000000000002';
const KENNIS = '00000000-0000-4000-8000-000000000105';
const VRIEND = '00000000-0000-4000-8000-000000000103';
const MEMORY = '00000000-0000-4000-8000-000000000206';

function fakeServer() {
  const tables = new Map<string, Map<string, Record<string, unknown>>>();
  let ts = Date.now() - 86_400_000;
  let offline = false;
  const t = (name: string) => tables.get(name) ?? tables.set(name, new Map()).get(name)!;
  const seed = (table: SyncTable, row: Record<string, unknown>) => {
    const now = new Date(++ts).toISOString();
    t(table).set(row.id as string, { created_at: now, deleted_at: null, ...row, updated_at: now });
  };
  seed('profiles', { id: P1, slot: 1, name: 'Bjorn', avatar_path: null, user_id: null });
  seed('profiles', { id: P2, slot: 2, name: 'Stephanie', avatar_path: null, user_id: null });
  seed('categories', { id: KENNIS, name: 'Kennissen', color: '#8A9590', icon: 'user', ring: 4, avatar_size: 38, group_key: 'acquaintances', display_order: 5, archived_at: null, description: null });
  seed('categories', { id: VRIEND, name: 'Goede vrienden', color: '#F5A266', icon: 'smile', ring: 3, avatar_size: 44, group_key: 'friends', display_order: 3, archived_at: null, description: null });
  seed('event_categories', { id: MEMORY, system_key: 'memory', name: 'Herinnering', color: '#C9A7F5', icon: 'star', display_order: 6, archived_at: null });
  seed('event_categories', { id: '00000000-0000-4000-8000-000000000201', system_key: 'first_meeting', name: 'Eerste ontmoeting', color: '#62E3B0', icon: 'handshake', display_order: 1, archived_at: null });
  const api: RemoteApi = {
    async upsert(table, row) {
      if (offline) throw new RemoteError('Failed to fetch', true);
      const now = new Date(++ts).toISOString();
      const old = t(table).get(row.id as string);
      t(table).set(row.id as string, { ...old, ...row, created_at: old?.created_at ?? row.created_at, updated_at: now });
      return now;
    },
    async fetchSince(table, since, from, to) {
      if (offline) throw new RemoteError('Failed to fetch', true);
      return [...t(table).values()]
        .filter((r) => !since || Date.parse(r.updated_at as string) > Date.parse(since))
        .sort((a, b) => (a.updated_at as string).localeCompare(b.updated_at as string))
        .slice(from, to + 1);
    },
  };
  return { api, rows: (table: string) => [...t(table).values()], setOffline: (v: boolean) => (offline = v) };
}

async function storeOf(db: OurNetworkDb): Promise<Store> {
  const entries = await Promise.all(SYNC_TABLES.map(async (t) => [t, await db.table(t).toArray()] as const));
  return buildStore(Object.fromEntries(entries) as never);
}

const input = (first: string, category_id: string, extra: Partial<PersonInput> = {}): PersonInput => ({
  first_name: first,
  last_name: null,
  avatar_path: null,
  birth_date: null,
  phone: null,
  email: null,
  other_contacts: [],
  description: null,
  notes: null,
  hobbies: null,
  interests: null,
  important_info: null,
  met_via: null,
  first_met_at: null,
  first_met_precision: 'day',
  added_at: '2026-10-27',
  category_id,
  ring_override: null,
  ...extra,
});

let n = 0;
const device = () => openDb(`device-${++n}-${crypto.randomUUID()}`);
/** Zelfde toestel opnieuw openen (openDb verwacht de gebruikers-id, niet de volledige databasenaam). */
const reopen = (db: OurNetworkDb) => openDb(db.name.replace(/^ournetwork-/, ''));

describe('sync tussen twee toestellen', () => {
  it('persoon + eerste ontmoeting + historie komen bij de ander aan', async () => {
    const server = fakeServer();
    const a = device();
    await syncOnce(a, server.api);
    const id = await savePerson(await storeOf(a), input('Thomas', KENNIS, { first_met_at: '2019-06-01', first_met_precision: 'month' }), {
      connections: [{ profileId: P1, description: 'collega' }],
      createFirstMeeting: true,
    });
    const r = await syncOnce(a, server.api);
    expect(r.blockedBy).toBeNull();
    expect(await a.outbox.count()).toBe(0);
    expect(server.rows('relationship_history')).toHaveLength(1);
    expect(server.rows('events')).toHaveLength(1);

    const b = device();
    await syncOnce(b, server.api);
    const sb = await storeOf(b);
    expect(sb.personById.get(id)?.first_name).toBe('Thomas');
    expect(sb.event_persons.filter((l) => l.person_id === id)).toHaveLength(1);
    expect(sb.person_connections[0]?.description).toBe('collega');
  });

  it('eerste ontmoeting achteraf toevoegen bij bewerken, maar nooit dubbel', async () => {
    const server = fakeServer();
    const a = device();
    await syncOnce(a, server.api);
    const id = await savePerson(await storeOf(a), input('Georgette', KENNIS), { connections: [] });
    const later = input('Georgette', KENNIS, { first_met_at: '1993-05-01', first_met_precision: 'day' });
    await savePerson(await storeOf(a), later, { id, connections: [], createFirstMeeting: true });
    await savePerson(await storeOf(a), later, { id, connections: [], createFirstMeeting: true });
    await syncOnce(a, server.api);
    expect(server.rows('events').map((e) => e.event_date)).toEqual(['1993-05-01']);
    expect(firstMeetingOf(await storeOf(a), id)?.event_date).toBe('1993-05-01');
  });

  it('categoriewijziging overschrijft niets: de oude categorie blijft in de geschiedenis', async () => {
    const server = fakeServer();
    const a = device();
    await syncOnce(a, server.api);
    const id = await savePerson(await storeOf(a), input('Lisa', KENNIS), { connections: [] });
    await savePerson(await storeOf(a), input('Lisa', VRIEND), { id, connections: [], categoryChange: { date: '2023-01-01', precision: 'year', description: 'samen op reis' } });
    await syncOnce(a, server.api);
    const hist = server.rows('relationship_history').filter((h) => h.person_id === id);
    expect(hist.map((h) => [h.previous_category_id, h.category_id, h.effective_date])).toEqual([
      [null, KENNIS, '2026-10-27'],
      [KENNIS, VRIEND, '2023-01-01'],
    ]);
  });

  it('een cursor in de toekomst wordt genegeerd: alles opnieuw ophalen', async () => {
    const server = fakeServer();
    const a = device();
    await a.meta.put({ key: 'cursor:categories', value: new Date(Date.now() + 3_600_000).toISOString() });
    await syncOnce(a, server.api);
    expect((await storeOf(a)).categories.map((c) => c.id).sort()).toEqual([VRIEND, KENNIS].sort());
  });

  it('offline wijzigingen blijven in de wachtrij en gaan later alsnog door', async () => {
    const server = fakeServer();
    const a = device();
    await syncOnce(a, server.api);
    server.setOffline(true);
    await savePerson(await storeOf(a), input('Kim', KENNIS), { connections: [] });
    await expect(syncOnce(a, server.api)).rejects.toThrow();
    expect(await a.outbox.count()).toBeGreaterThan(0);
    server.setOffline(false);
    await syncOnce(a, server.api);
    expect(await a.outbox.count()).toBe(0);
    expect(server.rows('persons').map((p) => p.first_name)).toContain('Kim');
  });

  it('gelijktijdige wijziging → conflict, nooit stil overschreven; keuze wordt toegepast', async () => {
    const server = fakeServer();
    const a = device();
    await syncOnce(a, server.api);
    const id = await savePerson(await storeOf(a), input('Mark', KENNIS), { connections: [] });
    await syncOnce(a, server.api);
    const b = device();
    await syncOnce(b, server.api);
    // A wijzigt offline (nog niet verstuurd)
    reopen(a);
    await write([change('persons', { id, notes: 'van A' })]);
    // B wijzigt hetzelfde en synchroniseert eerst
    const b2 = reopen(b);
    await write([change('persons', { id, notes: 'van B' })]);
    await syncOnce(b2, server.api);
    // terug naar A: conflict
    const a2 = reopen(a);
    const r = await syncOnce(a2, server.api);
    expect(r.conflicts).toBe(1);
    expect(server.rows('persons').find((p) => p.id === id)?.notes).toBe('van B');
    await resolveConflict(a2, `persons:${id}`, 'mine');
    await syncOnce(a2, server.api);
    expect(server.rows('persons').find((p) => p.id === id)?.notes).toBe('van A');
  });

  it('dezelfde koppeling op twee toestellen offline → één rij (deterministische id)', async () => {
    const server = fakeServer();
    const a = device();
    await syncOnce(a, server.api);
    const pid = await savePerson(await storeOf(a), input('Eva', KENNIS), { connections: [] });
    const eid = await saveEvent(await storeOf(a), { title: 'Etentje', description: null, personal_note: null, event_date: '2024-02-02', date_precision: 'day', event_end_date: null, event_category_id: MEMORY, theme: null, location: null, is_highlight: false, is_private: false }, { personIds: [], profileIds: [] });
    await syncOnce(a, server.api);
    const b = device();
    await syncOnce(b, server.api);
    const sb = await storeOf(b);
    await saveEvent(sb, { ...sb.eventById.get(eid)! }, { personIds: [pid], profileIds: [P2] }, eid);
    await syncOnce(b, server.api);
    const a2 = reopen(a);
    await saveEvent(await storeOf(a2), { ...(await storeOf(a2)).eventById.get(eid)! }, { personIds: [pid], profileIds: [P1] }, eid);
    await syncOnce(a2, server.api);
    expect(server.rows('event_persons').filter((l) => l.event_id === eid && !l.deleted_at)).toHaveLength(1);
  });

  it('archiveren en verwijderen van een persoon laat gebeurtenissen intact', async () => {
    const server = fakeServer();
    const a = device();
    await syncOnce(a, server.api);
    const pid = await savePerson(await storeOf(a), input('Daan', KENNIS), { connections: [] });
    const eid = await saveEvent(await storeOf(a), { title: 'Uitstap', description: null, personal_note: null, event_date: '2025-05-05', date_precision: 'day', event_end_date: null, event_category_id: MEMORY, theme: null, location: null, is_highlight: false, is_private: false }, { personIds: [pid], profileIds: [P1] });
    const s1 = await storeOf(a);
    await archivePerson(s1.personById.get(pid)!, { date: '2026-10-27', precision: 'day' }, null);
    await deletePerson(await storeOf(a), (await storeOf(a)).personById.get(pid)!);
    await syncOnce(a, server.api);
    const s2 = await storeOf(a);
    expect(s2.eventById.get(eid)).toBeTruthy();
    expect(s2.event_persons.filter((l) => l.event_id === eid)).toHaveLength(1);
    expect(s2.persons.find((p) => p.id === pid)).toBeUndefined();
    expect(s2.relationship_history.some((h) => h.person_id === pid && h.status === 'archived')).toBe(true);
  });

  it('back-up exporteren en in een leeg toestel importeren geeft hetzelfde netwerk', async () => {
    const server = fakeServer();
    const a = device();
    await syncOnce(a, server.api);
    await savePerson(await storeOf(a), input('Sanne', VRIEND), { connections: [{ profileId: P2, description: null }] });
    const json = JSON.stringify(buildBackup(await storeOf(a)));
    const b = device();
    const r = await importBackup(await storeOf(b), json);
    expect(r.added).toBeGreaterThan(5);
    const again = await importBackup(await storeOf(b), json);
    expect(again.added + again.updated).toBe(0);
    await expect(importBackup(await storeOf(b), '{"foo":1}')).rejects.toThrow(/geen geldige/);
  });

  it("overzetten vanuit de artifact: foto's opnieuw opgeslagen, artifact-koppeling weg, back-up gaat voor", async () => {
    const server = fakeServer();
    const a = device();
    await syncOnce(a, server.api);
    const pid = await savePerson(await storeOf(a), input('Mam', VRIEND, { avatar_path: 'f55a22e8762b18744820b78a305bb831' }), { connections: [] });
    const backup = buildBackup(await storeOf(a));
    const profile = (backup.tables.profiles as Record<string, unknown>[]).find((p) => p.id === P1)!;
    Object.assign(profile, { user_id: 'u_evh_LdvhQreFD0qLaxyMHQ', name: 'Bjorn W', updated_at: '2026-10-27T11:12:36.445Z' });
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const json = JSON.stringify({ ...backup, version: 2, files: { f55a22e8762b18744820b78a305bb831: png } });

    // Nieuw toestel met de standaardinhoud van de server (nieuwer dan de back-up): zonder "gaat voor" overgeslagen.
    const b = device();
    await syncOnce(b, server.api);
    await importBackup(await storeOf(b), json);
    expect((await storeOf(b)).profileById.get(P1)?.name).toBe('Bjorn');

    const c = device();
    await syncOnce(c, server.api);
    uploads.length = 0;
    const r = await importBackup(await storeOf(c), json, { overwrite: true });
    const sc = await storeOf(c);
    expect(sc.profileById.get(P1)).toMatchObject({ name: 'Bjorn W', user_id: null });
    expect(r.photos).toBe(1);
    expect(uploads[0]!.path).toMatch(new RegExp(`^avatars/persons/${pid}/[0-9a-f-]{36}\\.jpg$`));
    expect(sc.personById.get(pid)?.avatar_path).toBe(uploads[0]!.path);
  });
});
