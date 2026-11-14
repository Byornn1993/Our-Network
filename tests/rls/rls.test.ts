import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { asUser, createDb, USER_A, USER_B, USER_C, type Tx } from './harness';

// Draait alle migraties op een echte (embedded) Postgres en controleert de beveiliging
// met drie gebruikers: het eerste lid, een uitgenodigd lid en een vreemde.

const uuid = () => crypto.randomUUID();
const FAMILIE = '00000000-0000-4000-8000-000000000101';
const KENNISSEN = '00000000-0000-4000-8000-000000000105';
const BJORN = '00000000-0000-4000-8000-000000000001';
const FIRST_MEETING = '00000000-0000-4000-8000-000000000201';

const claim = (tx: Tx) => tx.query<{ ok: boolean }>('select public.net_claim_membership() as ok').then((r) => r.rows[0]!.ok);
const count = (tx: Tx, sql: string, params: unknown[] = []) => tx.query<{ n: number }>(`select count(*)::int as n from ${sql}`, params).then((r) => r.rows[0]!.n);

async function rejects(p: Promise<unknown>) {
  await expect(p).rejects.toThrow();
}

let db: PGlite;
const thomas = uuid();
const event = uuid();
const privateEvent = uuid();

beforeAll(async () => {
  db = await createDb({ storage: true });
});

describe('lidmaatschap', () => {
  it('een vreemde ziet niets zolang er geen lid is', async () => {
    const n = await asUser(db, USER_C, (tx) => count(tx, 'public.net_categories'));
    expect(n).toBe(0);
  });

  it('de eerste gebruiker die inlogt wordt lid (bootstrap)', async () => {
    expect(await asUser(db, USER_A, claim)).toBe(true);
    expect(await asUser(db, USER_A, (tx) => count(tx, 'public.net_categories'))).toBe(5);
    expect(await asUser(db, USER_A, (tx) => count(tx, 'public.net_profiles'))).toBe(2);
    expect(await asUser(db, USER_A, (tx) => count(tx, 'public.net_event_categories'))).toBe(7);
  });

  it('daarna wordt een niet-uitgenodigde gebruiker GEEN lid', async () => {
    expect(await asUser(db, USER_C, claim)).toBe(false);
    expect(await asUser(db, USER_C, (tx) => count(tx, 'public.net_profiles'))).toBe(0);
  });

  it('een vreemde kan zichzelf niet uitnodigen', async () => {
    await rejects(asUser(db, USER_C, (tx) => tx.query(`insert into public.net_allowed_emails (email) values ('c@test.be')`)));
  });

  it('een lid nodigt uit; de uitgenodigde wordt lid bij inloggen (hoofdletterongevoelig)', async () => {
    await asUser(db, USER_A, (tx) => tx.query(`insert into public.net_allowed_emails (email) values ('b@test.be')`));
    expect(await asUser(db, USER_B, claim)).toBe(true);
    expect(await asUser(db, USER_B, (tx) => count(tx, 'public.net_members'))).toBe(2);
  });

  it('anon heeft nergens toegang', async () => {
    await rejects(asUser(db, null, (tx) => tx.query('select * from public.net_persons')));
    await rejects(asUser(db, null, (tx) => tx.query('select public.net_claim_membership()')));
  });
});

describe('gedeelde netwerkruimte', () => {
  it('lid A voegt een persoon toe; lid B ziet en wijzigt die', async () => {
    await asUser(db, USER_A, async (tx) => {
      await tx.query(`insert into public.net_persons (id, first_name, category_id, first_met_at) values ($1, 'Thomas', $2, '2019-06-01')`, [thomas, KENNISSEN]);
      await tx.query(`insert into public.net_person_connections (id, person_id, profile_id) values ($1, $2, $3)`, [uuid(), thomas, BJORN]);
    });
    const row = await asUser(db, USER_B, (tx) => tx.query<{ first_name: string; created_by: string }>('select first_name, created_by from public.net_persons where id = $1', [thomas]));
    expect(row.rows[0]).toEqual({ first_name: 'Thomas', created_by: USER_A });
    await asUser(db, USER_B, (tx) => tx.query(`update public.net_persons set category_id = $2 where id = $1`, [thomas, FAMILIE]));
  });

  it('een vreemde ziet de persoon niet en kan niets toevoegen', async () => {
    expect(await asUser(db, USER_C, (tx) => count(tx, 'public.net_persons'))).toBe(0);
    await rejects(asUser(db, USER_C, (tx) => tx.query(`insert into public.net_persons (id, first_name, category_id) values ($1, 'X', $2)`, [uuid(), KENNISSEN])));
    const upd = await asUser(db, USER_C, (tx) => tx.query(`update public.net_persons set first_name = 'Hack' where id = $1`, [thomas]));
    expect(upd.affectedRows ?? 0).toBe(0);
  });

  it('niemand kan rijen definitief verwijderen (alleen soft delete)', async () => {
    await rejects(asUser(db, USER_A, (tx) => tx.query('delete from public.net_persons where id = $1', [thomas])));
    await asUser(db, USER_A, (tx) => tx.query('update public.net_persons set deleted_at = now() where id = $1', [thomas]));
    await asUser(db, USER_A, (tx) => tx.query('update public.net_persons set deleted_at = null where id = $1', [thomas]));
    expect(await asUser(db, USER_A, (tx) => count(tx, 'public.net_persons where id = $1', [thomas]))).toBe(1);
  });

  it('server zet updated_at en bewaart created_at/created_by bij een update', async () => {
    const r = await asUser(db, USER_B, async (tx) => {
      await tx.query(`update public.net_persons set created_at = '2000-01-01', created_by = $2, notes = 'x' where id = $1`, [thomas, USER_B]);
      return tx.query<{ created_by: string; y: number }>('select created_by, extract(year from created_at)::int as y from public.net_persons where id = $1', [thomas]);
    });
    expect(r.rows[0]).toEqual({ created_by: USER_A, y: new Date().getFullYear() });
  });

  it('relatiegeschiedenis bewaart elke wijziging met ingangsdatum', async () => {
    await asUser(db, USER_A, async (tx) => {
      await tx.query(`insert into public.net_relationship_history (id, person_id, change_type, category_id, effective_date) values ($1, $2, 'category', $3, '2019-06-01')`, [uuid(), thomas, KENNISSEN]);
      await tx.query(
        `insert into public.net_relationship_history (id, person_id, change_type, category_id, previous_category_id, effective_date) values ($1, $2, 'category', $3, $4, '2023-01-01')`,
        [uuid(), thomas, FAMILIE, KENNISSEN],
      );
    });
    const n = await asUser(db, USER_B, (tx) => count(tx, 'public.net_relationship_history where person_id = $1', [thomas]));
    expect(n).toBe(2);
    // ongeldige combinatie wordt geweigerd
    await rejects(asUser(db, USER_A, (tx) => tx.query(`insert into public.net_relationship_history (id, person_id, change_type, effective_date) values ($1, $2, 'category', '2024-01-01')`, [uuid(), thomas])));
  });

  it('een relatie tussen dezelfde twee personen bestaat maar één keer (in beide richtingen)', async () => {
    const lisa = uuid();
    await asUser(db, USER_A, async (tx) => {
      await tx.query(`insert into public.net_persons (id, first_name, category_id) values ($1, 'Lisa', $2)`, [lisa, KENNISSEN]);
      await tx.query(`insert into public.net_relationships (id, person_id, related_person_id, relationship_type) values ($1, $2, $3, 'partner')`, [uuid(), thomas, lisa]);
    });
    await rejects(asUser(db, USER_A, (tx) => tx.query(`insert into public.net_relationships (id, person_id, related_person_id, relationship_type) values ($1, $2, $3, 'partner')`, [uuid(), lisa, thomas])));
    await rejects(asUser(db, USER_A, (tx) => tx.query(`insert into public.net_relationships (id, person_id, related_person_id, relationship_type) values ($1, $2, $2, 'friend')`, [uuid(), lisa])));
  });
});

describe('Our Story', () => {
  it('één gebeurtenis gekoppeld aan meerdere personen en profielen', async () => {
    const kevin = uuid();
    await asUser(db, USER_A, async (tx) => {
      await tx.query(`insert into public.net_persons (id, first_name, category_id) values ($1, 'Kevin', $2)`, [kevin, KENNISSEN]);
      await tx.query(`insert into public.net_events (id, title, event_date, event_category_id) values ($1, 'Vakantie', '2025-07-10', $2)`, [event, FIRST_MEETING]);
      await tx.query(`insert into public.net_event_persons (id, event_id, person_id) values ($1, $2, $3), ($4, $2, $5)`, [uuid(), event, thomas, uuid(), kevin]);
      await tx.query(`insert into public.net_event_profiles (id, event_id, profile_id) values ($1, $2, $3)`, [uuid(), event, BJORN]);
    });
    expect(await asUser(db, USER_B, (tx) => count(tx, 'public.net_event_persons where event_id = $1', [event]))).toBe(2);
    expect(await asUser(db, USER_B, (tx) => count(tx, 'public.net_event_persons where person_id = $1', [thomas]))).toBe(1);
  });

  it('gebeurtenissen blijven bestaan als een persoon gearchiveerd of verwijderd (soft) wordt', async () => {
    await asUser(db, USER_A, (tx) => tx.query('update public.net_persons set archived_at = now() where id = $1', [thomas]));
    await asUser(db, USER_A, (tx) => tx.query('update public.net_persons set deleted_at = now() where id = $1', [thomas]));
    expect(await asUser(db, USER_B, (tx) => count(tx, 'public.net_events where id = $1 and deleted_at is null', [event]))).toBe(1);
    expect(await asUser(db, USER_B, (tx) => count(tx, 'public.net_event_persons where event_id = $1', [event]))).toBe(2);
    await asUser(db, USER_A, (tx) => tx.query('update public.net_persons set deleted_at = null, archived_at = null where id = $1', [thomas]));
  });

  it('einddatum vóór begindatum wordt geweigerd', async () => {
    await rejects(
      asUser(db, USER_A, (tx) => tx.query(`insert into public.net_events (id, title, event_date, event_end_date, event_category_id) values ($1, 'x', '2025-01-02', '2025-01-01', $2)`, [uuid(), FIRST_MEETING])),
    );
  });

  it('een privé-herinnering is enkel zichtbaar voor de maker, ook de koppelingen en foto’s', async () => {
    const photo = uuid();
    await asUser(db, USER_A, async (tx) => {
      await tx.query(`insert into public.net_events (id, title, event_date, event_category_id, is_private) values ($1, 'Privé', '2024-02-02', $2, true)`, [privateEvent, FIRST_MEETING]);
      await tx.query(`insert into public.net_event_persons (id, event_id, person_id) values ($1, $2, $3)`, [uuid(), privateEvent, thomas]);
      await tx.query(`insert into public.net_event_photos (id, event_id, storage_path) values ($1, $2, $3)`, [photo, privateEvent, `events/${privateEvent}/${uuid()}.jpg`]);
      await tx.query(`insert into public.net_photo_persons (id, photo_id, person_id) values ($1, $2, $3)`, [uuid(), photo, thomas]);
    });
    expect(await asUser(db, USER_A, (tx) => count(tx, 'public.net_events where id = $1', [privateEvent]))).toBe(1);
    expect(await asUser(db, USER_B, (tx) => count(tx, 'public.net_events where id = $1', [privateEvent]))).toBe(0);
    expect(await asUser(db, USER_B, (tx) => count(tx, 'public.net_event_persons where event_id = $1', [privateEvent]))).toBe(0);
    expect(await asUser(db, USER_B, (tx) => count(tx, 'public.net_event_photos where event_id = $1', [privateEvent]))).toBe(0);
    expect(await asUser(db, USER_B, (tx) => count(tx, 'public.net_photo_persons where photo_id = $1', [photo]))).toBe(0);
    // B kan er ook niets aan koppelen of wijzigen
    await rejects(asUser(db, USER_B, (tx) => tx.query(`insert into public.net_event_persons (id, event_id, person_id) values ($1, $2, $3)`, [uuid(), privateEvent, thomas])));
    const upd = await asUser(db, USER_B, (tx) => tx.query(`update public.net_events set title = 'x' where id = $1`, [privateEvent]));
    expect(upd.affectedRows ?? 0).toBe(0);
  });

  it('B kan een gewone gebeurtenis van A niet stiekem privé maken voor zichzelf', async () => {
    await rejects(asUser(db, USER_B, (tx) => tx.query(`update public.net_events set is_private = true where id = $1`, [event])));
  });
});

describe('storage', () => {
  it('de bucket is privé', async () => {
    const r = await db.query<{ public: boolean }>(`select public from storage.buckets where id = 'net-photos'`);
    expect(r.rows[0]!.public).toBe(false);
  });

  it('leden mogen uploaden en lezen; vreemden niet', async () => {
    const path = `avatars/persons/${thomas}/${uuid()}.jpg`;
    await asUser(db, USER_A, (tx) => tx.query(`insert into storage.objects (bucket_id, name) values ('net-photos', $1)`, [path]));
    expect(await asUser(db, USER_B, (tx) => count(tx, 'storage.objects where name = $1', [path]))).toBe(1);
    expect(await asUser(db, USER_C, (tx) => count(tx, 'storage.objects where name = $1', [path]))).toBe(0);
    await rejects(asUser(db, USER_C, (tx) => tx.query(`insert into storage.objects (bucket_id, name) values ('net-photos', $1)`, [`avatars/persons/${thomas}/${uuid()}.jpg`])));
  });

  it('alleen de afgesproken mappenstructuur is toegestaan', async () => {
    await rejects(asUser(db, USER_A, (tx) => tx.query(`insert into storage.objects (bucket_id, name) values ('net-photos', 'random/../x.jpg')`)));
    await rejects(asUser(db, USER_A, (tx) => tx.query(`insert into storage.objects (bucket_id, name) values ('net-photos', $1)`, [`events/${event}/${uuid()}.exe`])));
  });
});
