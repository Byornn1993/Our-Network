import { buildStore, type Store } from '@/lib/db/store';
import { SYNC_TABLES, type Category, type EventCategory, type Person, type Profile, type RowTypes, type SyncTable } from '@/lib/db/types';

// Bouwstenen voor tests: een Store opbouwen zonder database.

let n = 0;
export const uid = () => `00000000-0000-4000-9000-${String(++n).padStart(12, '0')}`;
const meta = (created = '2026-01-01T10:00:00.000Z') => ({ created_at: created, updated_at: created, deleted_at: null, _base: created });

export const P1 = '00000000-0000-4000-8000-000000000001';
export const P2 = '00000000-0000-4000-8000-000000000002';

export function profiles(): Profile[] {
  return [
    { id: P1, slot: 1, name: 'Bjorn', avatar_path: null, user_id: null, ...meta() },
    { id: P2, slot: 2, name: 'Stephanie', avatar_path: null, user_id: null, ...meta() },
  ];
}

export function category(name: string, ring: 1 | 2 | 3 | 4, group: Category['group_key'], order: number): Category {
  return { id: uid(), name, description: null, color: '#E9B949', icon: 'home', ring, avatar_size: 44, group_key: group, display_order: order, archived_at: null, ...meta() };
}

export function eventCategory(system_key: EventCategory['system_key'], name: string): EventCategory {
  return { id: uid(), system_key, name, color: '#62E3B0', icon: 'star', display_order: 1, archived_at: null, ...meta() };
}

export function person(first: string, category_id: string, extra: Partial<Person> = {}): Person {
  return {
    id: uid(),
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
    added_at: '2026-01-01',
    category_id,
    ring_override: null,
    archived_at: null,
    ...meta(),
    ...extra,
  };
}

export function row<T extends SyncTable>(_table: T, fields: Omit<RowTypes[T], 'created_at' | 'updated_at' | 'deleted_at' | 'id'> & { id?: string }): RowTypes[T] {
  return { id: uid(), ...meta(), ...fields } as RowTypes[T];
}

export function makeStore(partial: Partial<{ [K in SyncTable]: RowTypes[K][] }>): Store {
  const all = Object.fromEntries(SYNC_TABLES.map((t) => [t, partial[t] ?? []])) as { [K in SyncTable]: RowTypes[K][] };
  return buildStore(all);
}
