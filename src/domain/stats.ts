import type { Store } from '@/lib/db/store';
import type { EventSystemKey, GroupKey, Person } from '@/lib/db/types';
import { yearOf } from './dates';
import { connectionSide } from './people';
import { eventKind } from './timeline';

// Statistieken: uitsluitend berekend uit opgeslagen gegevens. Gearchiveerde personen tellen niet mee
// in het huidige netwerk, wel in de geschiedenis (jaaroverzicht).

export const activePersons = (s: Store): Person[] => s.persons.filter((p) => !p.archived_at);

export interface NetworkStats {
  total: number;
  byGroup: Record<GroupKey, number>;
  byCategory: { id: string; name: string; color: string; count: number }[];
  common: number;
  bjorn: number;
  stephanie: number;
  newPersonsThisYear: number;
  newEventsThisYear: number;
}

export function networkStats(s: Store, now = new Date()): NetworkStats {
  const persons = activePersons(s);
  const year = now.getFullYear();
  const byGroup: Record<GroupKey, number> = { family: 0, friends: 0, colleagues: 0, acquaintances: 0, other: 0 };
  const byCat = new Map<string, number>();
  let common = 0;
  let bjorn = 0;
  let stephanie = 0;
  for (const p of persons) {
    const c = s.categoryById.get(p.category_id);
    byGroup[c?.group_key ?? 'other']++;
    byCat.set(p.category_id, (byCat.get(p.category_id) ?? 0) + 1);
    const side = connectionSide(p.id, s.person_connections, s.profiles);
    if (side === 'both') common++;
    if (side === 'both' || side === 'bjorn') bjorn++;
    if (side === 'both' || side === 'stephanie') stephanie++;
  }
  return {
    total: persons.length,
    byGroup,
    byCategory: s.categories
      .map((c) => ({ id: c.id, name: c.name, color: c.color, count: byCat.get(c.id) ?? 0 }))
      .filter((c) => c.count > 0 || !s.categoryById.get(c.id)?.archived_at),
    common,
    bjorn,
    stephanie,
    newPersonsThisYear: persons.filter((p) => yearOf(p.first_met_at ?? p.added_at) === year).length,
    newEventsThisYear: s.events.filter((e) => yearOf(e.event_date) === year).length,
  };
}

export interface YearReview {
  year: number;
  newPeople: Person[];
  eventCount: number;
  byKind: Partial<Record<EventSystemKey | 'other', number>>;
  highlights: string[];
  closer: number;
  photoCount: number;
}

/** "Ons netwerk in 2026": alles uit echte gegevens van dat jaar. */
export function yearReview(s: Store, year: number): YearReview {
  const events = s.events.filter((e) => yearOf(e.event_date) === year);
  const byKind: YearReview['byKind'] = {};
  for (const e of events) {
    const k = eventKind(s, e) ?? 'other';
    byKind[k] = (byKind[k] ?? 0) + 1;
  }
  const eventIds = new Set(events.map((e) => e.id));
  // "dichterbij gekomen": categoriewijziging naar een lagere (dichtere) ring
  const closer = s.relationship_history.filter((h) => {
    if (h.change_type !== 'category' || yearOf(h.effective_date) !== year || !h.previous_category_id || !h.category_id) return false;
    const from = s.categoryById.get(h.previous_category_id)?.ring ?? 4;
    const to = s.categoryById.get(h.category_id)?.ring ?? 4;
    return to < from;
  }).length;
  return {
    year,
    newPeople: s.persons.filter((p) => p.first_met_at && yearOf(p.first_met_at) === year),
    eventCount: events.length,
    byKind,
    highlights: events.filter((e) => e.is_highlight).map((e) => e.id),
    closer,
    photoCount: s.event_photos.filter((p) => eventIds.has(p.event_id)).length,
  };
}

/** Jaren met data (gebeurtenissen, leren kennen, relatiewijzigingen), nieuwste eerst. */
export function activeYears(s: Store): number[] {
  const ys = new Set<number>();
  s.events.forEach((e) => ys.add(yearOf(e.event_date)));
  s.persons.forEach((p) => p.first_met_at && ys.add(yearOf(p.first_met_at)));
  s.relationship_history.forEach((h) => ys.add(yearOf(h.effective_date)));
  return [...ys].sort((a, b) => b - a);
}
