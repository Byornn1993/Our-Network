import type { Store } from '@/lib/db/store';
import type { DatePrecision, EventSystemKey, GroupKey, Person, RelationshipHistory, StoryEvent } from '@/lib/db/types';
import { monthOf, yearOf } from './dates';
import { fullName } from './people';

// Our Story: één chronologische lijst uit echte, ingevoerde gegevens.
//  * gebeurtenissen (events)
//  * relatiewijzigingen (relationship_history: "Thomas wordt beste vriend")
//  * op een persoonlijke tijdlijn ook: leren kennen (first_met_at) en toegevoegd aan het netwerk (added_at)
// Nieuwste eerst.

export type TimelineItem =
  | { kind: 'event'; key: string; date: string; precision: DatePrecision; createdAt: string; event: StoryEvent }
  | { kind: 'change'; key: string; date: string; precision: DatePrecision; createdAt: string; change: RelationshipHistory; person: Person }
  | { kind: 'met'; key: string; date: string; precision: DatePrecision; createdAt: string; person: Person }
  | { kind: 'added'; key: string; date: string; precision: DatePrecision; createdAt: string; person: Person };

export const byNewest = (a: TimelineItem, b: TimelineItem) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);

export function eventPersonIds(s: Store, eventId: string): string[] {
  return s.event_persons.filter((l) => l.event_id === eventId).map((l) => l.person_id);
}

export function eventProfileSlots(s: Store, eventId: string): Set<number> {
  return new Set(s.event_profiles.filter((l) => l.event_id === eventId).map((l) => s.profileById.get(l.profile_id)?.slot ?? 0));
}

/** Gebeurtenistype (system_key) van een gebeurtenis, of null voor eigen types. */
export const eventKind = (s: Store, e: StoryEvent): EventSystemKey | null => s.eventCategoryById.get(e.event_category_id)?.system_key ?? null;

export function globalTimeline(s: Store, opts: { includeChanges?: boolean } = {}): TimelineItem[] {
  const items: TimelineItem[] = s.events.map((event) => ({
    kind: 'event',
    key: `e:${event.id}`,
    date: event.event_date,
    precision: event.date_precision,
    createdAt: event.created_at,
    event,
  }));
  if (opts.includeChanges ?? true) {
    for (const change of s.relationship_history) {
      const person = s.personById.get(change.person_id);
      // De allereerste categorie ("startpunt") is geen verandering; die tonen we enkel op het profiel.
      if (!person || person.deleted_at || (change.change_type === 'category' && !change.previous_category_id)) continue;
      items.push({ kind: 'change', key: `c:${change.id}`, date: change.effective_date, precision: change.date_precision, createdAt: change.created_at, change, person });
    }
  }
  return items.sort(byNewest);
}

export function personTimeline(s: Store, personId: string): TimelineItem[] {
  const person = s.personById.get(personId);
  if (!person) return [];
  const eventIds = new Set(s.event_persons.filter((l) => l.person_id === personId).map((l) => l.event_id));
  const items: TimelineItem[] = s.events
    .filter((e) => eventIds.has(e.id))
    .map((event) => ({ kind: 'event', key: `e:${event.id}`, date: event.event_date, precision: event.date_precision, createdAt: event.created_at, event }));
  for (const change of s.relationship_history.filter((h) => h.person_id === personId))
    items.push({ kind: 'change', key: `c:${change.id}`, date: change.effective_date, precision: change.date_precision, createdAt: change.created_at, change, person });
  // "Leren kennen" enkel tonen als er geen gekoppelde eerste-ontmoeting-gebeurtenis is (geen dubbel).
  const hasFirstMeeting = s.events.some((e) => eventIds.has(e.id) && eventKind(s, e) === 'first_meeting');
  if (person.first_met_at && !hasFirstMeeting)
    items.push({ kind: 'met', key: `m:${person.id}`, date: person.first_met_at, precision: person.first_met_precision, createdAt: person.created_at, person });
  items.push({ kind: 'added', key: `a:${person.id}`, date: person.added_at, precision: 'day', createdAt: person.created_at, person });
  return items.sort(byNewest);
}

export interface YearGroup {
  year: number;
  months: { month: number | null; items: TimelineItem[] }[];
  count: number;
}

/** Groepeert per jaar en per maand. Items met enkel een jaar komen onder "month: null" (achteraan het jaar). */
export function groupByYearMonth(items: TimelineItem[]): YearGroup[] {
  const years = new Map<number, Map<number | null, TimelineItem[]>>();
  for (const it of items) {
    const y = yearOf(it.date);
    const m = it.precision === 'year' ? null : monthOf(it.date);
    if (!years.has(y)) years.set(y, new Map());
    const months = years.get(y)!;
    if (!months.has(m)) months.set(m, []);
    months.get(m)!.push(it);
  }
  return [...years.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, months]) => ({
      year,
      months: [...months.entries()].sort((a, b) => (b[0] ?? 0) - (a[0] ?? 0)).map(([month, its]) => ({ month, items: its })),
      count: [...months.values()].reduce((n, l) => n + l.length, 0),
    }));
}

// ───────────────────────── filters ─────────────────────────

export type WhoFilter = 'all' | 'bjorn' | 'stephanie' | 'common';
export type KindFilter = 'all' | GroupKey | 'first_meeting' | 'birthday' | 'highlight';

export interface TimelineFilter {
  who: WhoFilter;
  kind: KindFilter;
  year: number | null;
  month: number | null;
  personId: string | null;
  query: string;
}

export const EMPTY_FILTER: TimelineFilter = { who: 'all', kind: 'all', year: null, month: null, personId: null, query: '' };

function itemPersons(s: Store, it: TimelineItem): Person[] {
  if (it.kind === 'event') return eventPersonIds(s, it.event.id).map((id) => s.personById.get(id)).filter((p): p is Person => !!p);
  return [it.person];
}

function itemSlots(s: Store, it: TimelineItem): Set<number> {
  if (it.kind === 'event') return eventProfileSlots(s, it.event.id);
  return new Set(
    s.person_connections.filter((c) => c.person_id === it.person.id).map((c) => s.profileById.get(c.profile_id)?.slot ?? 0),
  );
}

export function applyFilter(s: Store, items: TimelineItem[], f: TimelineFilter): TimelineItem[] {
  const q = f.query.trim().toLowerCase();
  return items.filter((it) => {
    if (f.year !== null && yearOf(it.date) !== f.year) return false;
    if (f.month !== null && (it.precision === 'year' || monthOf(it.date) !== f.month)) return false;
    const persons = itemPersons(s, it);
    if (f.personId && !persons.some((p) => p.id === f.personId)) return false;
    if (f.who !== 'all') {
      const slots = itemSlots(s, it);
      if (f.who === 'bjorn' && !slots.has(1)) return false;
      if (f.who === 'stephanie' && !slots.has(2)) return false;
      if (f.who === 'common' && !(slots.has(1) && slots.has(2))) return false;
    }
    if (f.kind !== 'all') {
      if (f.kind === 'first_meeting') {
        if (!(it.kind === 'met' || (it.kind === 'event' && eventKind(s, it.event) === 'first_meeting'))) return false;
      } else if (f.kind === 'birthday') {
        if (!(it.kind === 'event' && eventKind(s, it.event) === 'birthday')) return false;
      } else if (f.kind === 'highlight') {
        if (!(it.kind === 'event' && it.event.is_highlight)) return false;
      } else {
        const groups = new Set(persons.map((p) => s.categoryById.get(p.category_id)?.group_key));
        const familyEvent = it.kind === 'event' && f.kind === 'family' && eventKind(s, it.event) === 'family';
        if (!groups.has(f.kind) && !familyEvent) return false;
      }
    }
    if (q) {
      const hay =
        it.kind === 'event'
          ? [it.event.title, it.event.description, it.event.location, it.event.theme, ...persons.map(fullName)]
          : [fullName(it.person), it.kind === 'change' ? it.change.description : null];
      if (!hay.filter(Boolean).some((v) => v!.toLowerCase().includes(q))) return false;
    }
    return true;
  });
}

/** Alle jaren waarin iets gebeurde (voor de jaarkiezer), nieuwste eerst. */
export function yearsWithItems(items: TimelineItem[]): number[] {
  return [...new Set(items.map((i) => yearOf(i.date)))].sort((a, b) => b - a);
}
