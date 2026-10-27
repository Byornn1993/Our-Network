// Automatische positionering van personen rond het middelpunt (Bjorn & Stephanie).
//  * Elke persoon staat op de ring van zijn/haar categorie (of de handmatige afstand).
//  * Binnen een ring staan categorieën samen (clusters), daarna alfabetisch.
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

export function layoutNetwork(nodes: LayoutNode[]): Layout {
  const placed = new Map<string, Placed>();
  for (const n of nodes) if (n.manual) placed.set(n.id, { id: n.id, x: n.manual.x, y: n.manual.y, size: n.size, ring: n.ring, manual: true });

  const ringRadii: number[] = [];
  let outer = HUB_RADIUS;
  const autoByRing = new Map<Ring, { node: LayoutNode; radius: number; angle: number }[]>();

  for (const ring of [1, 2, 3, 4] as Ring[]) {
    const autos = nodes
      .filter((n) => n.ring === ring && !n.manual)
      .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, 'nl'));
    const radius = Math.max(BASE_RADII[ring], outer + MIN_RING_GAP);
    ringRadii.push(radius);
    if (!autos.length) {
      outer = radius;
      continue;
    }
    const widths = autos.map(footprint);
    const total = widths.reduce((s, w) => s + w, 0);
    // Aantal sub-ringen zodat elke sub-ring past (elke sub-ring krijgt elke k-de persoon).
    let k = 1;
    while (total / k > 2 * Math.PI * (radius + (k - 1) * SUB_GAP * 0.5) && k < 8) k++;
    const start = -Math.PI / 2 + (ring - 1) * 0.37;
    let cum = 0;
    const list: { node: LayoutNode; radius: number; angle: number }[] = [];
    autos.forEach((node, i) => {
      const angle = start + (2 * Math.PI * (cum + widths[i]! / 2)) / total;
      cum += widths[i]!;
      const sub = i % k;
      list.push({ node, radius: radius + sub * SUB_GAP, angle });
    });
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
      ring: a.node.ring,
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
