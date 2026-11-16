import type { Category, Person, PersonConnection, Profile } from '@/lib/db/types';

export const fullName = (p: Pick<Person, 'first_name' | 'last_name'>): string => [p.first_name, p.last_name].filter(Boolean).join(' ').trim();

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = parts[0]![0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]![0] ?? '') : '';
  return (first + last).toUpperCase();
}

/** Ring op de kaart: handmatige afstand gaat voor op de standaard van de categorie. */
export const ringOf = (p: Person, c: Category | undefined): 1 | 2 | 3 | 4 => p.ring_override ?? c?.ring ?? 4;

export type ConnectionSide = 'both' | 'bjorn' | 'stephanie' | 'none';

/** Met wie is deze persoon verbonden? slot 1 = Bjorn, slot 2 = Stephanie. */
export function connectionSide(personId: string, connections: PersonConnection[], profiles: Profile[]): ConnectionSide {
  const slots = new Set(
    connections.filter((c) => c.person_id === personId && !c.deleted_at).map((c) => profiles.find((p) => p.id === c.profile_id)?.slot),
  );
  if (slots.has(1) && slots.has(2)) return 'both';
  if (slots.has(1)) return 'bjorn';
  if (slots.has(2)) return 'stephanie';
  return 'none';
}

export function connectionLabel(side: ConnectionSide, profiles: Profile[]): string {
  const b = profiles.find((p) => p.slot === 1)?.name ?? 'Bjorn';
  const s = profiles.find((p) => p.slot === 2)?.name ?? 'Stephanie';
  return side === 'both' ? `${b} & ${s}` : side === 'bjorn' ? b : side === 'stephanie' ? s : '';
}

export const RELATIONSHIP_LABEL = {
  partner: 'Partner',
  family: 'Familie',
  friend: 'Vriend(in)',
  colleague: 'Collega',
  other: 'Andere',
} as const;

export function matchesSearch(p: Person, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return [p.first_name, p.last_name, p.description, p.met_via, p.email, p.phone]
    .filter(Boolean)
    .some((v) => v!.toLowerCase().includes(s));
}
