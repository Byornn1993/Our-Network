import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Maximize2, Minus, Plus } from 'lucide-react';
import { HUB_RADIUS, layoutNetwork, type Ring } from '@/domain/layout';
import { initials, type ConnectionSide } from '@/domain/people';
import { useSignedUrl } from '@/lib/images';
import type { Profile } from '@/lib/db/types';
import { IconButton } from '@/components/ui/Button';

// Interactieve netwerkkaart (eigen SVG, geen externe bibliotheek):
//  * pan: slepen op de achtergrond (muis, vinger) · zoom: scrollwiel, knijpen, knoppen
//  * klik/tik op een persoon → profiel · hover (desktop) → korte preview
//  * bewerkmodus: personen verslepen; de positie wordt bewaard (gedeeld tussen beide toestellen)

export interface MapPerson {
  id: string;
  name: string;
  label: string;
  avatarPath: string | null;
  color: string;
  size: number;
  ring: Ring;
  order: number;
  /** Partner (op de kaart meteen ernaast). */
  partnerId?: string | null;
  side: ConnectionSide;
  subtitle: string;
}

interface View {
  x: number;
  y: number;
  k: number;
}

// Rustige lijnen vanuit het middelpunt: dun en zacht, sterker bij aanwijzen.
const LINE: Record<Ring, { w: number; o: number }> = { 1: { w: 1.6, o: 0.55 }, 2: { w: 1.3, o: 0.4 }, 3: { w: 1, o: 0.3 }, 4: { w: 0.8, o: 0.22 } };
const CONTROLS_W = 48;
/** Onderaan ligt de legende over de kaart: daar zetten we niemand. */
const LEGEND_H = 64;
const MIN_K = 0.25;
const MAX_K = 3;
const clampK = (k: number) => Math.min(MAX_K, Math.max(MIN_K, k));

/** Vertrekpunt van de lijn: bij Bjorn (links), Stephanie (rechts) of het midden (beiden). */
function originOf(side: ConnectionSide): { x: number; y: number } {
  return side === 'bjorn' ? { x: -22, y: 0 } : side === 'stephanie' ? { x: 22, y: 0 } : { x: 0, y: 0 };
}

function SvgAvatar({ id, path, name, size, color, x = 0, y = 0, glow }: { id: string; path: string | null; name: string; size: number; color: string; x?: number; y?: number; glow?: boolean }) {
  const url = useSignedUrl(path);
  const r = size / 2;
  return (
    <g transform={`translate(${x} ${y})`}>
      {glow && <circle r={r + 6} fill={color} opacity={0.18} />}
      <circle r={r} fill="var(--surface-2)" />
      {url ? (
        <>
          <clipPath id={`clip-${id}`}>
            <circle r={r} />
          </clipPath>
          <image href={url} x={-r} y={-r} width={size} height={size} clipPath={`url(#clip-${id})`} preserveAspectRatio="xMidYMid slice" />
        </>
      ) : (
        <text textAnchor="middle" dominantBaseline="central" fontSize={size * 0.36} fontWeight={600} fill="var(--muted)">
          {initials(name)}
        </text>
      )}
      <circle r={r} fill="none" stroke={color} strokeWidth={Math.max(2, size / 18)} />
    </g>
  );
}

export function NetworkMap({
  persons,
  manual,
  relations,
  profiles,
  editMode,
  showLabels,
  focusId,
  resetToken,
  onOpen,
  onOpenHub,
  onMove,
  controls,
}: {
  persons: MapPerson[];
  manual: Map<string, { x: number; y: number }>;
  relations: { a: string; b: string; partner?: boolean }[];
  profiles: Profile[];
  editMode: boolean;
  showLabels: boolean;
  focusId: string | null;
  resetToken: number;
  onOpen: (id: string) => void;
  onOpenHub: () => void;
  onMove: (id: string, x: number, y: number) => void;
  controls?: ReactNode;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 });
  const [animate, setAnimate] = useState(false);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const userMoved = useRef(false);

  const layout = useMemo(
    () => layoutNetwork(persons.map((p) => ({ id: p.id, ring: p.ring, size: p.size, label: p.label, order: p.order, partner: p.partnerId, manual: manual.get(p.id) ?? null }))),
    [persons, manual],
  );

  const fitView = useCallback(
    (w: number, h: number): View => {
      // Op smalle schermen houden we rechts ruimte vrij voor de bedieningsknoppen.
      const usable = w < 640 ? w - CONTROLS_W : w;
      const usableH = Math.max(h - LEGEND_H, h * 0.6);
      const k = clampK(Math.min(usable, usableH) / (2 * layout.extent + 20));
      return { x: usable / 2, y: usableH / 2, k };
    },
    [layout.extent],
  );

  // Grootte volgen; zolang de gebruiker niet zelf zoomde/pande, blijft alles passend in beeld.
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry!.contentRect;
      setSize({ w: width, h: height });
      if (!userMoved.current) setView(fitView(width, height));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fitView]);

  // Terug naar de standaardweergave
  useEffect(() => {
    if (!resetToken) return;
    userMoved.current = false;
    setAnimate(true);
    setView(fitView(size.w, size.h));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetToken]);

  // Zoeken: naar de persoon toe bewegen
  useEffect(() => {
    if (!focusId) return;
    const p = layout.placed.get(focusId);
    if (!p || !size.w) return;
    userMoved.current = true;
    setAnimate(true);
    setView((v) => {
      const k = Math.max(v.k, 1.15);
      return { k, x: size.w / 2 - p.x * k, y: size.h / 2 - p.y * k };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId]);

  const zoomAt = useCallback((factor: number, sx: number, sy: number, anim = false) => {
    userMoved.current = true;
    setAnimate(anim);
    setView((v) => {
      const k = clampK(v.k * factor);
      const f = k / v.k;
      return { k, x: sx - (sx - v.x) * f, y: sy - (sy - v.y) * f };
    });
  }, []);

  // Scrollwiel / trackpad (niet-passief om de pagina niet mee te laten scrollen)
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018)), e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  // ── pointer-gebaren
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<
    | { type: 'pan'; sx: number; sy: number; v: View; node: string | null }
    | { type: 'pinch'; d: number; mx: number; my: number; v: View }
    | { type: 'drag'; id: string; dx: number; dy: number; sx: number; sy: number }
    | null
  >(null);
  const moved = useRef(false);

  const local = (e: { clientX: number; clientY: number }) => {
    const r = svg.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const nodeOf = (target: EventTarget | null) => (target as Element | null)?.closest?.('[data-node]')?.getAttribute('data-node') ?? null;

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const pt = local(e);
    pointers.current.set(e.pointerId, pt);
    svg.current?.setPointerCapture(e.pointerId);
    setAnimate(false);
    moved.current = false;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
      gesture.current = { type: 'pinch', d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, v: view };
      setDrag(null);
      return;
    }
    const node = nodeOf(e.target);
    const placed = node ? layout.placed.get(node) : null;
    if (node && placed && editMode) {
      gesture.current = { type: 'drag', id: node, dx: (pt.x - view.x) / view.k - placed.x, dy: (pt.y - view.y) / view.k - placed.y, sx: pt.x, sy: pt.y };
    } else {
      gesture.current = { type: 'pan', sx: pt.x, sy: pt.y, v: view, node };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const pt = local(e);
    if (!pointers.current.has(e.pointerId)) {
      if (e.pointerType === 'mouse') setHover(nodeOf(e.target));
      return;
    }
    pointers.current.set(e.pointerId, pt);
    const g = gesture.current;
    if (!g) return;
    if (g.type === 'pinch' && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const k = clampK((g.v.k * d) / g.d);
      const f = k / g.v.k;
      moved.current = true;
      userMoved.current = true;
      setView({ k, x: mx - (g.mx - g.v.x) * f, y: my - (g.my - g.v.y) * f });
    } else if (g.type === 'pan') {
      if (Math.hypot(pt.x - g.sx, pt.y - g.sy) > 6) moved.current = true;
      if (moved.current) {
        userMoved.current = true;
        setView({ ...g.v, x: g.v.x + pt.x - g.sx, y: g.v.y + pt.y - g.sy });
      }
    } else if (g.type === 'drag') {
      if (Math.hypot(pt.x - g.sx, pt.y - g.sy) > 4) moved.current = true;
      if (moved.current) setDrag({ id: g.id, x: (pt.x - view.x) / view.k - g.dx, y: (pt.y - view.y) / view.k - g.dy });
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (pointers.current.size > 0) {
      // van knijpen terug naar één vinger: verder pannen vanaf hier
      const [rest] = [...pointers.current.values()];
      if (rest) gesture.current = { type: 'pan', sx: rest.x, sy: rest.y, v: view, node: null };
      return;
    }
    gesture.current = null;
    if (!g) return;
    if (g.type === 'drag') {
      if (moved.current && drag) {
        userMoved.current = true; // niet herschalen omdat de kaart iets groter/kleiner werd
        onMove(g.id, drag.x, drag.y);
      }
      else onOpen(g.id);
      setDrag(null);
    } else if (g.type === 'pan' && !moved.current) {
      if (g.node === '__hub') onOpenHub();
      else if (g.node) onOpen(g.node);
    }
  };

  const pos = (id: string) => (drag?.id === id ? drag : layout.placed.get(id));
  const byId = useMemo(() => new Map(persons.map((p) => [p.id, p])), [persons]);
  const bjorn = profiles.find((p) => p.slot === 1);
  const steph = profiles.find((p) => p.slot === 2);
  const labelsVisible = showLabels && view.k > 0.3;
  // Namen blijven leesbaar (±11 px op het scherm) bij uitzoomen, zonder groter te worden bij inzoomen.
  const labelSize = Math.min(19, Math.max(12, 11 / view.k));
  const hovered = hover && hover !== '__hub' ? byId.get(hover) : null;
  const hoveredPos = hovered ? pos(hovered.id) : null;

  return (
    <div ref={wrap} className="relative h-full w-full overflow-hidden">
      <svg
        ref={svg}
        className={`h-full w-full select-none ${editMode ? 'cursor-move' : 'cursor-grab active:cursor-grabbing'}`}
        style={{ touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => setHover(null)}
        role="img"
        aria-label={`Netwerkkaart met ${persons.length} personen`}
      >
        <defs>
          <radialGradient id="hub-glow">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0.5" />
            <stop offset="0.45" stopColor="var(--accent)" stopOpacity="0.16" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="map-bg">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0.06" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <g
          style={{
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`,
            transformOrigin: '0 0',
            transition: animate ? 'transform 420ms cubic-bezier(.2,.8,.2,1)' : 'none',
          }}
        >
          <circle r={layout.extent} fill="url(#map-bg)" />
          {layout.ringRadii.map((r, i) => (
            <circle key={i} r={r} fill="none" stroke="var(--map-ring)" strokeWidth={1.2} />
          ))}

          {/* onderlinge relaties */}
          {relations.map(({ a, b, partner }) => {
            const pa = pos(a);
            const pb = pos(b);
            if (!pa || !pb) return null;
            if (partner) {
              // Koppel: lijn tussen beide foto's met een hartje in het midden.
              const mx = (pa.x + pb.x) / 2;
              const my = (pa.y + pb.y) / 2;
              return (
                <g key={`${a}-${b}`} aria-hidden>
                  <line x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke="var(--champ)" strokeOpacity={0.8} strokeWidth={2} strokeLinecap="round" />
                  <circle cx={mx} cy={my} r={8} fill="var(--bg)" stroke="var(--champ)" strokeWidth={1.2} />
                  <path
                    transform={`translate(${mx - 4.5} ${my - 4})`}
                    d="M4.5 8 C1.5 5.8 0 4.3 0 2.6 0 1.1 1.1 0 2.4 0 3.3 0 4 .5 4.5 1.2 5 .5 5.7 0 6.6 0 7.9 0 9 1.1 9 2.6 9 4.3 7.5 5.8 4.5 8Z"
                    fill="var(--accent)"
                  />
                </g>
              );
            }
            return <line key={`${a}-${b}`} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke="var(--muted)" strokeOpacity={0.35} strokeWidth={1} strokeDasharray="4 5" />;
          })}

          {/* verbindingslijnen vanuit het middelpunt */}
          {persons.map((p) => {
            const q = pos(p.id);
            if (!q) return null;
            const o = originOf(p.side);
            const style = LINE[p.ring];
            return (
              <g key={`l-${p.id}`}>
                <line x1={o.x} y1={o.y} x2={q.x} y2={q.y} stroke={p.color} strokeOpacity={hover === p.id ? 1 : style.o} strokeWidth={style.w} strokeLinecap="round" />
              </g>
            );
          })}

          {/* middelpunt: Bjorn & Stephanie */}
          <g data-node="__hub" className="cursor-pointer" role="button" aria-label="Bjorn en Stephanie">
            <circle r={HUB_RADIUS * 2.1} fill="url(#hub-glow)" className="anim-glow" />
            <circle r={HUB_RADIUS} fill="var(--card)" stroke="var(--accent)" strokeWidth={3} />
            {bjorn && <SvgAvatar id="hub-b" path={bjorn.avatar_path} name={bjorn.name} size={50} color="var(--gold)" x={-22} y={-8} />}
            {steph && <SvgAvatar id="hub-s" path={steph.avatar_path} name={steph.name} size={50} color="var(--accent)" x={22} y={-8} />}
            <text y={36} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--text)">
              {bjorn?.name ?? 'Bjorn'} & {steph?.name ?? 'Stephanie'}
            </text>
          </g>

          {/* personen */}
          {persons.map((p) => {
            const q = pos(p.id);
            if (!q) return null;
            const focused = focusId === p.id;
            return (
              <g
                key={p.id}
                data-node={p.id}
                transform={`translate(${q.x} ${q.y})`}
                className="cursor-pointer outline-none"
                tabIndex={0}
                role="button"
                aria-label={`${p.name}, ${p.subtitle}`}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpen(p.id))}
              >
                {focused && <circle r={p.size / 2 + 10} fill="none" stroke="var(--accent)" strokeWidth={2.5} className="anim-glow" />}
                <SvgAvatar id={p.id} path={p.avatarPath} name={p.name} size={p.size} color={p.color} glow={p.ring === 1 || hover === p.id} />
                {labelsVisible && (
                  <text
                    y={p.size / 2 + labelSize + 2}
                    textAnchor="middle"
                    fontSize={labelSize}
                    fontWeight={500}
                    fill="var(--map-label)"
                    stroke="var(--bg)"
                    strokeWidth={labelSize / 4}
                    paintOrder="stroke"
                    style={{ pointerEvents: 'none' }}
                  >
                    {p.label}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* hover-preview (desktop) */}
      {hovered && hoveredPos && !drag && (
        <div
          className="pointer-events-none absolute z-10 w-56 -translate-x-1/2 rounded-xl border border-border bg-surface-2 p-3 text-sm shadow-xl"
          style={{ left: view.x + hoveredPos.x * view.k, top: view.y + (hoveredPos.y + hovered.size / 2) * view.k + 10 }}
        >
          <p className="font-semibold">{hovered.name}</p>
          <p className="text-xs text-muted">{hovered.subtitle}</p>
        </div>
      )}

      <div className="absolute bottom-3 right-2 flex flex-col gap-0.5 rounded-2xl border border-border bg-surface-2 p-0.5 [&>button]:min-h-[40px] [&>button]:min-w-[40px]">
        <IconButton label="Inzoomen" onClick={() => zoomAt(1.3, size.w / 2, size.h / 2, true)}>
          <Plus size={18} />
        </IconButton>
        <IconButton label="Uitzoomen" onClick={() => zoomAt(1 / 1.3, size.w / 2, size.h / 2, true)}>
          <Minus size={18} />
        </IconButton>
        <IconButton
          label="Standaardweergave"
          onClick={() => {
            userMoved.current = false;
            setAnimate(true);
            setView(fitView(size.w, size.h));
          }}
        >
          <Maximize2 size={17} />
        </IconButton>
        {controls}
      </div>
    </div>
  );
}
