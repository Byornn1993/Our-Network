import { change, linkId, newId, softDelete, syncLinks, write, type Change } from '@/lib/db/repo';
import type { Store } from '@/lib/db/store';
import type { Category, DatePrecision, EventCategory, Person, RelationshipType, StoryEvent } from '@/lib/db/types';
import { todayIso } from '@/domain/dates';
import { fullName } from '@/domain/people';

// Alle wijzigingen die de app doet, op één plaats. Elke actie = één lokale transactie + outbox.
// Geschiedenis wordt nooit overschreven: een nieuwe categorie of status = een nieuwe rij in relationship_history.

export type PersonInput = Omit<Person, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | '_base' | 'archived_at'>;

export interface ConnectionInput {
  profileId: string;
  description: string | null;
}

export interface DateInput {
  date: string;
  precision: DatePrecision;
}

export async function savePerson(
  s: Store,
  input: PersonInput,
  opts: {
    id?: string;
    connections: ConnectionInput[];
    /** Bij een categoriewijziging: vanaf wanneer geldt de nieuwe categorie, en waarom. */
    categoryChange?: DateInput & { description: string | null };
    /** Een "eerste ontmoeting" in Our Story zetten (nieuwe persoon, of bestaande zonder zo'n moment). */
    createFirstMeeting?: boolean;
  },
): Promise<string> {
  const existing = opts.id ? s.personById.get(opts.id) : undefined;
  const id = opts.id ?? newId();
  const changes: Change[] = [change('persons', { ...input, id })];

  if (!existing) {
    // Startpunt van de relatiegeschiedenis
    changes.push(
      change('relationship_history', {
        id: newId(),
        person_id: id,
        change_type: 'category',
        category_id: input.category_id,
        previous_category_id: null,
        status: null,
        effective_date: input.first_met_at ?? input.added_at,
        date_precision: input.first_met_at ? input.first_met_precision : 'day',
        description: null,
      }),
    );
  } else if (existing.category_id !== input.category_id) {
    const c = opts.categoryChange ?? { date: todayIso(), precision: 'day' as const, description: null };
    changes.push(
      change('relationship_history', {
        id: newId(),
        person_id: id,
        change_type: 'category',
        category_id: input.category_id,
        previous_category_id: existing.category_id,
        status: null,
        effective_date: c.date,
        date_precision: c.precision,
        description: c.description,
      }),
    );
  }

  const descById = new Map(opts.connections.map((c) => [c.profileId, c.description]));
  changes.push(
    ...syncLinks('person_connections', s.raw.person_connections, { field: 'person_id', id }, { field: 'profile_id' }, [...descById.keys()], (pid) => ({
      description: descById.get(pid) ?? null,
    })),
  );

  if (opts.createFirstMeeting && input.first_met_at && !(existing && firstMeetingOf(s, id))) {
    const type = s.event_categories.find((c) => c.system_key === 'first_meeting');
    if (type) {
      const eventId = newId();
      changes.push(
        change('events', {
          id: eventId,
          title: `Eerste ontmoeting met ${fullName(input)}`,
          description: input.met_via ? `Leren kennen via ${input.met_via}.` : null,
          personal_note: null,
          event_date: input.first_met_at,
          date_precision: input.first_met_precision,
          event_end_date: null,
          event_category_id: type.id,
          theme: null,
          location: null,
          is_highlight: false,
          is_private: false,
        }),
        change('event_persons', { id: linkId('event_persons', eventId, id), event_id: eventId, person_id: id, deleted_at: null }),
        ...[...descById.keys()].map((pid) => change('event_profiles', { id: linkId('event_profiles', eventId, pid), event_id: eventId, profile_id: pid, deleted_at: null })),
      );
    }
  }

  await write(changes);
  return id;
}

/** Het bestaande "eerste ontmoeting"-moment van een persoon, als dat er is. */
export function firstMeetingOf(s: Store, personId: string): StoryEvent | undefined {
  const type = s.event_categories.find((c) => c.system_key === 'first_meeting');
  if (!type) return undefined;
  return s.event_persons
    .filter((l) => l.person_id === personId)
    .map((l) => s.eventById.get(l.event_id))
    .find((e): e is StoryEvent => !!e && e.event_category_id === type.id);
}

export async function setPersonAvatar(personId: string, path: string | null): Promise<void> {
  await write([change('persons', { id: personId, avatar_path: path })]);
}

export async function archivePerson(p: Person, at: DateInput, description: string | null): Promise<void> {
  await write([
    change('persons', { id: p.id, archived_at: new Date().toISOString() }),
    change('relationship_history', {
      id: newId(),
      person_id: p.id,
      change_type: 'status',
      status: 'archived',
      category_id: null,
      previous_category_id: null,
      effective_date: at.date,
      date_precision: at.precision,
      description,
    }),
  ]);
}

export async function restorePerson(p: Person): Promise<void> {
  await write([
    change('persons', { id: p.id, archived_at: null }),
    change('relationship_history', {
      id: newId(),
      person_id: p.id,
      change_type: 'status',
      status: 'active',
      category_id: null,
      previous_category_id: null,
      effective_date: todayIso(),
      date_precision: 'day',
      description: null,
    }),
  ]);
}

/**
 * Persoon verwijderen. Gebeurtenissen blijven bestaan (ze kunnen over meerdere mensen gaan);
 * de koppeling blijft bewaard zodat de herinnering compleet blijft. Enkel de kaartpositie verdwijnt.
 */
export async function deletePerson(s: Store, p: Person): Promise<void> {
  const changes: Change[] = [softDelete('persons', p.id)];
  if (s.network_positions.some((n) => n.id === p.id)) changes.push(softDelete('network_positions', p.id));
  for (const r of s.relationships.filter((r) => r.person_id === p.id || r.related_person_id === p.id)) changes.push(softDelete('relationships', r.id));
  await write(changes);
}

export async function updateHistoryEntry(id: string, patch: { effective_date: string; date_precision: DatePrecision; description: string | null }): Promise<void> {
  await write([change('relationship_history', { id, ...patch })]);
}

// ───────────────────────── kaart ─────────────────────────

export async function savePosition(personId: string, x: number, y: number): Promise<void> {
  // id = person_id: één positie per persoon, ook als twee toestellen tegelijk slepen.
  await write([change('network_positions', { id: personId, person_id: personId, x_position: Math.round(x * 10) / 10, y_position: Math.round(y * 10) / 10, deleted_at: null })]);
}

export async function resetPositions(s: Store, personIds?: string[]): Promise<void> {
  const ids = personIds ? new Set(personIds) : null;
  await write(s.network_positions.filter((p) => !ids || ids.has(p.person_id)).map((p) => softDelete('network_positions', p.id)));
}

// ───────────────────────── relaties ─────────────────────────

export async function saveRelationship(
  s: Store,
  input: { id?: string; personId: string; relatedId: string; type: RelationshipType; description: string | null; since: string | null },
): Promise<void> {
  const [a, b] = [input.personId, input.relatedId].sort() as [string, string];
  // Deterministisch per paar + type: komt overeen met de unieke index op de server.
  const id = input.id ?? linkId('relationships', a, b, input.type);
  const existing = s.raw.relationships.find((r) => r.id === id);
  await write([
    change('relationships', {
      id,
      person_id: existing?.person_id ?? input.personId,
      related_person_id: existing?.related_person_id ?? input.relatedId,
      relationship_type: input.type,
      description: input.description,
      since_date: input.since,
      deleted_at: null,
    }),
  ]);
}

export async function deleteRelationship(id: string): Promise<void> {
  await write([softDelete('relationships', id)]);
}

// ───────────────────────── categorieën ─────────────────────────

export type CategoryInput = Pick<Category, 'name' | 'description' | 'color' | 'icon' | 'ring' | 'avatar_size' | 'group_key' | 'display_order'>;

export async function saveCategory(input: CategoryInput, id?: string): Promise<string> {
  const cid = id ?? newId();
  await write([change('categories', { ...input, id: cid, archived_at: null })]);
  return cid;
}

/** Categorieën met personen worden gearchiveerd (geschiedenis verwijst ernaar), lege worden verwijderd. */
export async function removeCategory(s: Store, c: Category): Promise<'archived' | 'deleted'> {
  const used = s.raw.persons.some((p) => p.category_id === c.id) || s.relationship_history.some((h) => h.category_id === c.id || h.previous_category_id === c.id);
  await write([used ? change('categories', { id: c.id, archived_at: new Date().toISOString() }) : softDelete('categories', c.id)]);
  return used ? 'archived' : 'deleted';
}

export async function reorder(table: 'categories' | 'event_categories', ids: string[]): Promise<void> {
  await write(ids.map((id, i) => change(table, { id, display_order: i + 1 })));
}

export type EventCategoryInput = Pick<EventCategory, 'name' | 'color' | 'icon' | 'display_order'>;

export async function saveEventCategory(input: EventCategoryInput, id?: string): Promise<string> {
  const cid = id ?? newId();
  await write([change('event_categories', { ...input, id: cid, archived_at: null })]);
  return cid;
}

export async function removeEventCategory(s: Store, c: EventCategory): Promise<'archived' | 'deleted'> {
  const used = s.raw.events.some((e) => e.event_category_id === c.id);
  await write([used || c.system_key ? change('event_categories', { id: c.id, archived_at: new Date().toISOString() }) : softDelete('event_categories', c.id)]);
  return used || c.system_key ? 'archived' : 'deleted';
}

// ───────────────────────── Our Story ─────────────────────────

export type EventInput = Omit<StoryEvent, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | '_base'>;

export async function saveEvent(s: Store, input: EventInput, links: { personIds: string[]; profileIds: string[] }, id?: string): Promise<string> {
  const eid = id ?? newId();
  await write([
    change('events', { ...input, id: eid }),
    ...syncLinks('event_persons', s.raw.event_persons, { field: 'event_id', id: eid }, { field: 'person_id' }, links.personIds),
    ...syncLinks('event_profiles', s.raw.event_profiles, { field: 'event_id', id: eid }, { field: 'profile_id' }, links.profileIds),
  ]);
  return eid;
}

/** Herinnering verwijderen (soft delete). Foto's blijven in de opslag tot ze apart verwijderd worden. */
export async function deleteEvent(eventId: string): Promise<void> {
  await write([softDelete('events', eventId)]);
}

export async function addEventPhotos(
  eventId: string,
  photos: { id: string; storage_path: string; thumb_path: string; width: number; height: number; display_order: number; personIds: string[] }[],
): Promise<void> {
  const changes: Change[] = [];
  for (const p of photos) {
    changes.push(
      change('event_photos', { id: p.id, event_id: eventId, storage_path: p.storage_path, thumb_path: p.thumb_path, width: p.width, height: p.height, display_order: p.display_order, caption: null }),
      ...p.personIds.map((pid) => change('photo_persons', { id: linkId('photo_persons', p.id, pid), photo_id: p.id, person_id: pid, deleted_at: null })),
    );
  }
  await write(changes);
}

export async function updatePhoto(s: Store, photoId: string, caption: string | null, personIds: string[]): Promise<void> {
  await write([
    change('event_photos', { id: photoId, caption }),
    ...syncLinks('photo_persons', s.raw.photo_persons, { field: 'photo_id', id: photoId }, { field: 'person_id' }, personIds),
  ]);
}

export async function deletePhoto(photoId: string): Promise<void> {
  await write([softDelete('event_photos', photoId)]);
}

// ───────────────────────── profielen ─────────────────────────

export async function saveProfile(id: string, patch: { name?: string; avatar_path?: string | null; user_id?: string | null }): Promise<void> {
  await write([change('profiles', { id, ...patch })]);
}
