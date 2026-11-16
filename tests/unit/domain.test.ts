import { describe, expect, it } from 'vitest';
import { BASE_RADII, HUB_RADIUS, layoutNetwork, minClearance, type LayoutNode } from '@/domain/layout';
import { daysUntilBirthday, durationSince, formatDate, normalizeToPrecision } from '@/domain/dates';
import { applyFilter, EMPTY_FILTER, globalTimeline, groupByYearMonth, personTimeline } from '@/domain/timeline';
import { networkStats, yearReview } from '@/domain/stats';
import { connectionSide, initials } from '@/domain/people';
import { category, eventCategory, makeStore, P1, P2, person, profiles, row } from './helpers';

const node = (id: string, ring: 1 | 2 | 3 | 4, extra: Partial<LayoutNode> = {}): LayoutNode => ({ id, ring, size: 44, label: id, order: ring, ...extra });

describe('netwerklayout', () => {
  it('zet iedereen op de straal van zijn ring', () => {
    const l = layoutNetwork([node('a', 1), node('b', 2), node('c', 3), node('d', 4)]);
    for (const [id, ring] of [['a', 1], ['b', 2], ['c', 3], ['d', 4]] as const) {
      const p = l.placed.get(id)!;
      expect(Math.hypot(p.x, p.y)).toBeCloseTo(BASE_RADII[ring], 0);
    }
  });

  it('geen overlappende foto’s, ook met 120 personen op één ring', () => {
    const nodes = Array.from({ length: 120 }, (_, i) => node(`p${i}`, 3, { label: `Persoon ${i}` }));
    const l = layoutNetwork(nodes);
    expect(l.placed.size).toBe(120);
    expect(minClearance([...l.placed.values()])).toBeGreaterThan(4);
    // niemand binnen de hub
    for (const p of l.placed.values()) expect(Math.hypot(p.x, p.y)).toBeGreaterThan(HUB_RADIUS + 40);
  });

  it('partners staan naast elkaar, ook alfabetisch ver uit elkaar en in een volle ring', () => {
    const others = Array.from({ length: 40 }, (_, i) => node(`m${String(i).padStart(2, '0')}`, 3, { label: `M${i}` }));
    const nodes = [node('aa', 3, { label: 'Anna', partner: 'zz' }), node('zz', 3, { label: 'Zeno', partner: 'aa' }), ...others];
    const l = layoutNetwork(nodes);
    const a = l.placed.get('aa')!;
    const z = l.placed.get('zz')!;
    const dist = Math.hypot(a.x - z.x, a.y - z.y);
    // dichter bij elkaar dan bij wie dan ook anders
    const nearestOther = Math.min(...others.map((o) => l.placed.get(o.id)!).map((p) => Math.hypot(a.x - p.x, a.y - p.y)));
    expect(dist).toBeLessThanOrEqual(nearestOther + 1);
    expect(Math.hypot(a.x, a.y)).toBeCloseTo(Math.hypot(z.x, z.y), 0); // zelfde (sub-)ring
  });

  it('partners uit verschillende ringen komen samen op de binnenste ring', () => {
    const l = layoutNetwork([node('fam', 1, { partner: 'vr' }), node('vr', 3, { partner: 'fam' }), node('x', 1), node('y', 3)]);
    const vr = l.placed.get('vr')!;
    expect(Math.hypot(vr.x, vr.y)).toBeCloseTo(BASE_RADII[1], 0);
    expect(vr.ring).toBe(1);
    // ook in een bijna lege ring vlak naast elkaar, niet over de hele cirkel verspreid
    const fam = l.placed.get('fam')!;
    expect(Math.hypot(fam.x - vr.x, fam.y - vr.y)).toBeLessThan(90);
    expect(minClearance([...l.placed.values()])).toBeGreaterThan(4);
  });

  it('volle binnenringen duwen buitenringen naar buiten', () => {
    const many = Array.from({ length: 60 }, (_, i) => node(`f${i}`, 1));
    const l = layoutNetwork([...many, node('far', 4)]);
    const inner = Math.max(...many.map((n) => Math.hypot(l.placed.get(n.id)!.x, l.placed.get(n.id)!.y)));
    const far = l.placed.get('far')!;
    expect(Math.hypot(far.x, far.y)).toBeGreaterThan(inner);
  });

  it('handmatige posities blijven exact; anderen wijken uit', () => {
    const nodes = [node('m', 2, { manual: { x: 0, y: -BASE_RADII[2] } }), ...Array.from({ length: 8 }, (_, i) => node(`a${i}`, 2))];
    const l = layoutNetwork(nodes);
    expect(l.placed.get('m')).toMatchObject({ x: 0, y: -BASE_RADII[2], manual: true });
    expect(minClearance([...l.placed.values()])).toBeGreaterThan(0);
  });

  it('is deterministisch (zelfde invoer → zelfde kaart op beide toestellen)', () => {
    const nodes = Array.from({ length: 30 }, (_, i) => node(`p${i}`, ((i % 4) + 1) as 1 | 2 | 3 | 4));
    expect([...layoutNetwork(nodes).placed.values()]).toEqual([...layoutNetwork(nodes).placed.values()]);
  });
});

describe('datums', () => {
  it('toont enkel de gekende precisie', () => {
    expect(formatDate('2024-03-14', 'day')).toBe('14 maart 2024');
    expect(formatDate('2019-06-01', 'month')).toBe('juni 2019');
    expect(formatDate('2015-01-01', 'year')).toBe('2015');
    expect(normalizeToPrecision('2019-06-23', 'month')).toBe('2019-06-01');
    expect(normalizeToPrecision('2019-06-23', 'year')).toBe('2019-01-01');
  });
  it('rekent duur en verjaardagen', () => {
    expect(durationSince('2010-05-01', new Date(2026, 9, 27))).toBe('16 jaar');
    expect(durationSince('2026-08-20', new Date(2026, 9, 27))).toBe('2 maanden');
    expect(daysUntilBirthday('1992-10-27', new Date(2026, 9, 27))).toBe(0);
    expect(daysUntilBirthday('1992-10-26', new Date(2026, 9, 27))).toBe(364);
    // 29 februari: in een gewoon jaar op 28 februari, in een schrikkeljaar op 29 februari
    expect(daysUntilBirthday('2000-02-29', new Date(2027, 1, 28))).toBe(0);
    expect(daysUntilBirthday('2000-02-29', new Date(2027, 2, 1))).toBe(365); // volgende: 29-02-2028
    expect(daysUntilBirthday('2000-02-29', new Date(2028, 1, 28))).toBe(1);
  });
  it('initialen', () => {
    expect(initials('Sophie Peeters')).toBe('SP');
    expect(initials('Kim')).toBe('K');
  });
});

describe('Our Story', () => {
  const fam = category('Familie', 1, 'family', 1);
  const friends = category('Goede vrienden', 3, 'friends', 2);
  const kennis = category('Kennissen', 4, 'acquaintances', 3);
  const fm = eventCategory('first_meeting', 'Eerste ontmoeting');
  const mem = eventCategory('memory', 'Herinnering');
  const thomas = person('Thomas', friends.id, { first_met_at: '2022-03-14' });
  const lisa = person('Lisa', fam.id);
  const kevin = person('Kevin', kennis.id, { first_met_at: '2019-01-01', first_met_precision: 'year' });
  const trip = row('events', {
    title: 'Vakantie 2025',
    description: null,
    personal_note: null,
    event_date: '2025-07-10',
    date_precision: 'day',
    event_end_date: '2025-07-20',
    event_category_id: mem.id,
    theme: null,
    location: 'Slovenië',
    is_highlight: true,
    is_private: false,
  });
  const meet = row('events', {
    title: 'Thomas leren kennen',
    description: null,
    personal_note: null,
    event_date: '2022-03-14',
    date_precision: 'day',
    event_end_date: null,
    event_category_id: fm.id,
    theme: null,
    location: null,
    is_highlight: false,
    is_private: false,
  });
  const s = makeStore({
    profiles: profiles(),
    categories: [fam, friends, kennis],
    event_categories: [fm, mem],
    persons: [thomas, lisa, kevin],
    events: [trip, meet],
    event_persons: [
      row('event_persons', { event_id: trip.id, person_id: thomas.id }),
      row('event_persons', { event_id: trip.id, person_id: lisa.id }),
      row('event_persons', { event_id: meet.id, person_id: thomas.id }),
    ],
    event_profiles: [row('event_profiles', { event_id: trip.id, profile_id: P1 }), row('event_profiles', { event_id: trip.id, profile_id: P2 }), row('event_profiles', { event_id: meet.id, profile_id: P1 })],
    person_connections: [row('person_connections', { person_id: thomas.id, profile_id: P1, description: null }), row('person_connections', { person_id: lisa.id, profile_id: P1, description: null }), row('person_connections', { person_id: lisa.id, profile_id: P2, description: 'zus' })],
    relationship_history: [
      row('relationship_history', { person_id: thomas.id, change_type: 'category', category_id: kennis.id, previous_category_id: null, status: null, effective_date: '2022-03-14', date_precision: 'day', description: null }),
      row('relationship_history', { person_id: thomas.id, change_type: 'category', category_id: friends.id, previous_category_id: kennis.id, status: null, effective_date: '2023-06-01', date_precision: 'month', description: null }),
    ],
  });

  it('één gebeurtenis verschijnt bij elke betrokken persoon, zonder dubbele opslag', () => {
    expect(personTimeline(s, thomas.id).filter((i) => i.kind === 'event')).toHaveLength(2);
    expect(personTimeline(s, lisa.id).filter((i) => i.kind === 'event').map((i) => i.key)).toEqual([`e:${trip.id}`]);
  });

  it('persoonlijke tijdlijn: geen dubbel "leren kennen" naast een eerste-ontmoeting-gebeurtenis', () => {
    expect(personTimeline(s, thomas.id).some((i) => i.kind === 'met')).toBe(false);
    expect(personTimeline(s, kevin.id).some((i) => i.kind === 'met')).toBe(true);
  });

  it('algemene tijdlijn: nieuwste eerst, relatiewijziging inbegrepen (zonder startpunt)', () => {
    const items = globalTimeline(s);
    expect(items.map((i) => i.date)).toEqual(['2025-07-10', '2023-06-01', '2022-03-14']);
    expect(groupByYearMonth(items).map((y) => y.year)).toEqual([2025, 2023, 2022]);
  });

  it('filters: wie, soort, jaar, persoon, zoeken', () => {
    const all = globalTimeline(s);
    expect(applyFilter(s, all, { ...EMPTY_FILTER, who: 'common' }).map((i) => i.key)).toEqual([`e:${trip.id}`]);
    expect(applyFilter(s, all, { ...EMPTY_FILTER, kind: 'first_meeting' }).map((i) => i.key)).toEqual([`e:${meet.id}`]);
    expect(applyFilter(s, all, { ...EMPTY_FILTER, kind: 'highlight' })).toHaveLength(1);
    expect(applyFilter(s, all, { ...EMPTY_FILTER, kind: 'family' }).map((i) => i.key)).toEqual([`e:${trip.id}`]);
    expect(applyFilter(s, all, { ...EMPTY_FILTER, year: 2022 })).toHaveLength(1);
    expect(applyFilter(s, all, { ...EMPTY_FILTER, personId: lisa.id })).toHaveLength(1);
    expect(applyFilter(s, all, { ...EMPTY_FILTER, query: 'sloven' })).toHaveLength(1);
  });

  it('statistieken en jaaroverzicht uit echte gegevens', () => {
    const st = networkStats(s, new Date(2026, 9, 27));
    expect(st.total).toBe(3);
    expect(st.byGroup).toMatchObject({ family: 1, friends: 1, acquaintances: 1 });
    expect(st.common).toBe(1);
    expect(st.bjorn).toBe(2);
    expect(st.stephanie).toBe(1);
    expect(connectionSide(kevin.id, s.person_connections, s.profiles)).toBe('none');
    const r = yearReview(s, 2023);
    expect(r.closer).toBe(1);
    expect(yearReview(s, 2025)).toMatchObject({ eventCount: 1, byKind: { memory: 1 } });
    expect(yearReview(s, 2019).newPeople.map((p) => p.first_name)).toEqual(['Kevin']);
  });
});
