// Automatische positionering van personen rond het middelpunt (Bjorn & Stephanie).
//  * Elke persoon staat op de ring van zijn/haar categorie (of de handmatige afstand).
//  * Binnen een ring staan categorieën samen (clusters), daarna alfabetisch.
//  * Partners staan altijd naast elkaar: op dezelfde (binnenste van hun twee) ring en sub-ring.
//  * Te vol? Dan wordt de ring verdeeld over meerdere sub-ringen (zigzag), en schuiven de buitenste
//    ringen mee naar buiten. Zo overlappen foto's en namen nooit.
//  * Handmatig verplaatste personen blijven exact staan; automatische personen wijken voor hen uit.
// Coördinaten zijn "wereld"-eenheden met het middelpunt op (0, 0).

export type Ring = 1 | 2 | 3 | 4;

export interface LayoutNode {
  id: string;
  ring: Ring;
  /** Diameter van de profielfoto. */
  size: number;
  label: string;
  /** Sorteervolgorde van de categorie (clusters). */
  order: number;
  manual?: { x: number; y: number } | null;
  /** Id van de partner: die komt er meteen naast te staan. */
  partner?: string | null;
}

export interface Placed {
  id: string;
  x: number;
  y: number;
  size: number;
  ring: Ring;
  manual: boolean;
}

export interface Layout {
  placed: Map<string, Placed>;
  /** Straal van elke ring zoals getekend (index 0 = ring 1). */
  ringRadii: number[];
  /** Halve breedte van het gebied dat alles bevat. */
  extent: number;
}

export const HUB_RADIUS = 66;
export const BASE_RADII: Record<Ring, number> = { 1: 135, 2: 205, 3: 275, 4: 345 };
const SUB_GAP = 64; // afstand tussen sub-ringen (foto + naam)
const MIN_RING_GAP = 66;
const LABEL_PAD = 24; // ruimte voor de naam onder de foto

/** Hoeveel boog (in eenheden) een persoon nodig heeft: foto of naam, wat het breedst is. */
export function footprint(n: Pick<LayoutNode, 'size' | 'label'>): number {
  const labelWidth = Math.min(130, n.label.length * 8.4 + 12);
  return Math.max(n.size + 20, labelWidth + 8);
}

function minDistance(a: { size: number }, b: { size: number }): number {
  return (a.size + b.size) / 2 + LABEL_PAD;
}

const byKey = (a: LayoutNode, b: LayoutNode) => a.order - b.order || a.label.localeCompare(b.label, 'nl');

/** Koppels (beide automatisch geplaatst) krijgen de ring van wie het dichtst bij het middelpunt staat. */
function pairUp(nodes: LayoutNode[]): { ringOf: Map<string, Ring>; partnerOf: Map<string, string> } {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const ringOf = new Map(nodes.map((n) => [n.id, n.ring]));
  const partnerOf = new Map<string, string>();
  for (const n of nodes) {
    const p = n.partner ? byId.get(n.partner) : undefined;
    if (!p || p === n || n.manual || p.manual || partnerOf.has(n.id) || partnerOf.has(p.id)) continue;
    partnerOf.set(n.id, p.id);
    partnerOf.set(p.id, n.id);
    const ring = Math.min(n.ring, p.ring) as Ring;
    ringOf.set(n.id, ring);
    ringOf.set(p.id, ring);
  }
  return { ringOf, partnerOf };
}

export function layoutNetwork(nodes: LayoutNode[]): Layout {
  const placed = new Map<string, Placed>();
  const { ringOf, partnerOf } = pairUp(nodes);
  for (const n of nodes) if (n.manual) placed.set(n.id, { id: n.id, x: n.manual.x, y: n.manual.y, size: n.size, ring: n.ring, manual: true });

  const ringRadii: number[] = [];
  let outer = HUB_RADIUS;
  const autoByRing = new Map<Ring, { node: LayoutNode; radius: number; angle: number }[]>();

  for (const ring of [1, 2, 3, 4] as Ring[]) {
    const inRing = nodes.filter((n) => ringOf.get(n.id) === ring && !n.manual).sort(byKey);
    // Eenheden: een alleenstaande persoon, of een koppel (gesorteerd op wie eerst komt).
    const units: LayoutNode[][] = [];
    const seen = new Set<string>();
    for (const n of inRing) {
      if (seen.has(n.id)) continue;
      const unit = [n, ...inRing.filter((m) => m.id === partnerOf.get(n.id))];
      unit.forEach((m) => seen.add(m.id));
      units.push(unit);
    }
    const autos = units.flat();
    const radius = Math.max(BASE_RADII[ring], outer + MIN_RING_GAP);
    ringRadii.push(radius);
    if (!autos.length) {
      outer = radius;
      continue;
    }
    const total = autos.reduce((s, n) => s + footprint(n), 0);
    // Aantal sub-ringen zodat elke sub-ring past (elke sub-ring krijgt elke k-de persoon).
    let k = 1;
    while (total / k > 2 * Math.PI * (radius + (k - 1) * SUB_GAP * 0.5) && k < 8) k++;
    // Sub-ring per eenheid, zodat een koppel samen op dezelfde sub-ring staat.
    const subOf = new Map(units.flatMap((u, i) => u.map((n) => [n.id, i % k] as const)));
    const start = -Math.PI / 2 + (ring - 1) * 0.37;
    let cum = 0;
    const list: { node: LayoutNode; radius: number; angle: number }[] = [];
    // Elke eenheid krijgt een stuk van de ring volgens haar breedte. Een koppel staat in dat stuk
    // vlak tegen elkaar (vaste afstand), niet verspreid zoals losse personen.
    for (const unit of units) {
      const w = unit.reduce((s, n) => s + footprint(n), 0);
      const center = start + (2 * Math.PI * (cum + w / 2)) / total;
      cum += w;
      const r = radius + (subOf.get(unit[0]!.id) ?? 0) * SUB_GAP;
      if (unit.length === 1) list.push({ node: unit[0]!, radius: r, angle: center });
      else {
        const [a, b] = unit as [LayoutNode, LayoutNode];
        const half = Math.max((footprint(a) + footprint(b)) / 2, minDistance(a, b) + 6) / 2 / r;
        list.push({ node: a, radius: r, angle: center - half }, { node: b, radius: r, angle: center + half });
      }
    }
    autoByRing.set(ring, list);
    outer = radius + (k - 1) * SUB_GAP;
  }

  // Uitwijken: automatische personen schuiven langs hun ring weg van handmatige posities
  // en van elkaar (bv. tussen sub-ringen).
  const autos = [...autoByRing.values()].flat();
  const manuals = [...placed.values()];
  for (let iter = 0; iter < 60; iter++) {
    let moved = false;
    for (const a of autos) {
      const ax = Math.cos(a.angle) * a.radius;
      const ay = Math.sin(a.angle) * a.radius;
      let push = 0;
      const others = [
        ...manuals.map((m) => ({ x: m.x, y: m.y, size: m.size })),
        ...autos.filter((b) => b !== a).map((b) => ({ x: Math.cos(b.angle) * b.radius, y: Math.sin(b.angle) * b.radius, size: b.node.size })),
      ];
      for (const o of others) {
        const dx = ax - o.x;
        const dy = ay - o.y;
        const d = Math.hypot(dx, dy);
        const need = minDistance(a.node, o);
        if (d < need) {
          // richting langs de raaklijn waarin we van o weg bewegen
          const tangential = -Math.sin(a.angle) * dx + Math.cos(a.angle) * dy;
          const dir = tangential === 0 ? (a.node.id < String(o.x) ? 1 : -1) : Math.sign(tangential);
          push += (dir * (need - d) * 0.5) / a.radius;
        }
      }
      if (Math.abs(push) > 1e-4) {
        a.angle += Math.max(-0.2, Math.min(0.2, push));
        moved = true;
      }
    }
    if (!moved) break;
  }

  for (const a of autos) {
    placed.set(a.node.id, {
      id: a.node.id,
      x: Math.cos(a.angle) * a.radius,
      y: Math.sin(a.angle) * a.radius,
      size: a.node.size,
      ring: ringOf.get(a.node.id) ?? a.node.ring,
      manual: false,
    });
  }

  let extent = (ringRadii[3] ?? BASE_RADII[4]) + 40;
  for (const p of placed.values()) extent = Math.max(extent, Math.abs(p.x) + p.size, Math.abs(p.y) + p.size + LABEL_PAD);
  return { placed, ringRadii, extent };
}

/** Kleinste afstand tussen twee geplaatste personen, gecorrigeerd voor hun grootte (voor tests). */
export function minClearance(placed: Placed[]): number {
  let min = Infinity;
  for (let i = 0; i < placed.length; i++)
    for (let j = i + 1; j < placed.length; j++) {
      const a = placed[i]!;
      const b = placed[j]!;
      min = Math.min(min, Math.hypot(a.x - b.x, a.y - b.y) - (a.size + b.size) / 2);
    }
  return min;
}
