import { Link } from 'react-router-dom';
import { tint } from '@/lib/color';
import { Archive, ArrowRight, Lock, MapPin, RotateCcw, Sparkles, Star, UserPlus } from 'lucide-react';
import { useStore } from '@/lib/db/store';
import type { EventPhoto } from '@/lib/db/types';
import { formatDate, formatRange, monthName } from '@/domain/dates';
import { fullName } from '@/domain/people';
import { groupByYearMonth, type TimelineItem } from '@/domain/timeline';
import { AvatarStack } from '@/components/Avatar';
import { Badge } from '@/components/ui/Form';
import { CatIcon } from '@/components/icons';
import { useSignedUrl } from '@/lib/images';

function Thumb({ photo, size = 56 }: { photo: EventPhoto; size?: number }) {
  const url = useSignedUrl(photo.thumb_path ?? photo.storage_path);
  return (
    <span className="block shrink-0 overflow-hidden rounded-lg bg-surface-2" style={{ width: size, height: size }}>
      {url && <img src={url} alt={photo.caption ?? ''} className="h-full w-full object-cover" loading="lazy" />}
    </span>
  );
}

export { Thumb as PhotoThumb };

function EventCard({ item }: { item: Extract<TimelineItem, { kind: 'event' }> }) {
  const s = useStore();
  const e = item.event;
  const type = s.eventCategoryById.get(e.event_category_id);
  const persons = s.event_persons
    .filter((l) => l.event_id === e.id)
    .map((l) => s.personById.get(l.person_id))
    .filter((p) => !!p);
  const linked = new Set(s.event_profiles.filter((l) => l.event_id === e.id).map((l) => l.profile_id));
  const profiles = s.profiles.filter((p) => linked.has(p.id));
  const photos = s.event_photos.filter((p) => p.event_id === e.id).sort((a, b) => a.display_order - b.display_order);
  const color = type?.color ?? 'var(--accent)';
  return (
    <Link to={`/story/${e.id}`} className="card anim-fade-up block p-3.5 transition hover:border-accent/40">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: tint(color, 0.13), color }}>
          <CatIcon name={type?.icon ?? 'sparkles'} size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted">{formatRange(e.event_date, e.event_end_date, e.date_precision)}</p>
          <p className="mt-0.5 flex items-center gap-1.5 font-semibold leading-snug">
            <span className="min-w-0">{e.title}</span>
            {e.is_highlight && <Star size={14} className="shrink-0 fill-[var(--gold)] text-gold" aria-label="Hoogtepunt" />}
            {e.is_private && <Lock size={13} className="shrink-0 text-muted" aria-label="Privé" />}
          </p>
          {e.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{e.description}</p>}
          {photos.length > 0 && (
            <div className="mt-2.5 flex gap-1.5">
              {photos.slice(0, 4).map((p) => (
                <Thumb key={p.id} photo={p} />
              ))}
              {photos.length > 4 && <span className="flex h-14 w-10 items-center justify-center text-xs text-muted">+{photos.length - 4}</span>}
            </div>
          )}
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {type && (
              <Badge color={color} size="sm">
                {type.name}
              </Badge>
            )}
            {e.location && (
              <span className="flex items-center gap-1 text-xs text-muted">
                <MapPin size={12} /> {e.location}
              </span>
            )}
            {(persons.length > 0 || profiles.length > 0) && (
              <span className="ml-auto">
                <AvatarStack
                  items={[
                    ...profiles.map((p) => ({ id: p.id, path: p.avatar_path, name: p.name })),
                    ...persons.map((p) => ({ id: p.id, path: p.avatar_path, name: fullName(p), color: s.categoryById.get(p.category_id)?.color })),
                  ]}
                />
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

/** Relatiewijziging, leren kennen, toegevoegd: kleinere, rustige kaart. */
function NoteCard({ item, showPerson }: { item: Exclude<TimelineItem, { kind: 'event' }>; showPerson: boolean }) {
  const s = useStore();
  const p = item.person;
  const name = fullName(p);
  let icon = <Sparkles size={15} />;
  let color = 'var(--accent)';
  let text: React.ReactNode;
  if (item.kind === 'change') {
    const h = item.change;
    if (h.change_type === 'category') {
      const to = s.categoryById.get(h.category_id!);
      const from = h.previous_category_id ? s.categoryById.get(h.previous_category_id) : null;
      color = to?.color ?? color;
      icon = <CatIcon name={to?.icon ?? 'sparkles'} size={15} />;
      text = from ? (
        <>
          {showPerson && <b>{name}: </b>}
          {from.name} <ArrowRight size={12} className="inline" /> <b style={{ color }}>{to?.name}</b>
        </>
      ) : (
        <>
          {showPerson && <b>{name} </b>}
          {showPerson ? 'start als' : 'Start als'} <b style={{ color }}>{to?.name}</b>
        </>
      );
    } else {
      icon = h.status === 'archived' ? <Archive size={15} /> : <RotateCcw size={15} />;
      color = 'var(--muted)';
      text = (
        <>
          {showPerson && <b>{name} </b>}
          {h.status === 'archived' ? (showPerson ? 'gearchiveerd' : 'Gearchiveerd') : showPerson ? 'terug actief' : 'Terug actief in ons netwerk'}
        </>
      );
    }
  } else if (item.kind === 'met') {
    icon = <CatIcon name="handshake" size={15} />;
    text = showPerson ? (
      <>
        <b>{name}</b> leren kennen
      </>
    ) : (
      <>Leren kennen{p.met_via ? ` via ${p.met_via}` : ''}</>
    );
  } else {
    icon = <UserPlus size={15} />;
    color = 'var(--muted)';
    text = showPerson ? (
      <>
        <b>{name}</b> toegevoegd aan ons netwerk
      </>
    ) : (
      <>Toegevoegd aan ons netwerk</>
    );
  }
  const desc = item.kind === 'change' ? item.change.description : null;
  const inner = (
    <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border px-3.5 py-2.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, color }}>
        {icon}
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="text-xs text-muted">{formatDate(item.date, item.precision)}</p>
        <p>{text}</p>
        {desc && <p className="text-xs text-muted">{desc}</p>}
      </div>
    </div>
  );
  return showPerson ? (
    <Link to={`/personen/${p.id}`} className="anim-fade-up block hover:opacity-90">
      {inner}
    </Link>
  ) : (
    <div className="anim-fade-up">{inner}</div>
  );
}

export function TimelineEntry({ item, showPerson = true }: { item: TimelineItem; showPerson?: boolean }) {
  return item.kind === 'event' ? <EventCard item={item} /> : <NoteCard item={item} showPerson={showPerson} />;
}

/** Verticale tijdlijn met jaartallen en maanden; nieuwste bovenaan. */
export function TimelineList({ items, showPerson = true }: { items: TimelineItem[]; showPerson?: boolean }) {
  const years = groupByYearMonth(items);
  return (
    <div className="space-y-8">
      {years.map((y) => (
        <section key={y.year} aria-label={String(y.year)}>
          <div className="sticky top-0 z-10 -mx-1 mb-3 flex items-baseline gap-3 bg-bg/95 px-1 py-2" style={{ top: 'var(--safe-top)' }}>
            <h2 className="text-2xl font-bold tracking-tight">{y.year}</h2>
            <span className="text-xs text-muted">
              {y.count} {y.count === 1 ? 'moment' : 'momenten'}
            </span>
            <Link to={`/story/jaar/${y.year}`} className="ml-auto text-xs text-accent hover:underline">
              Jaaroverzicht
            </Link>
          </div>
          <ol className="relative ml-[5px] space-y-4 border-l border-border pl-5">
            {y.months.map((m) => (
              <li key={`${y.year}-${m.month}`} className="relative">
                <span className="absolute -left-[26px] top-1 h-[11px] w-[11px] rounded-full border-2 border-bg bg-accent shadow-[0_0_10px_var(--accent)]" aria-hidden />
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{m.month ? `${monthName(m.month)} ${y.year}` : `In ${y.year}`}</p>
                <div className="space-y-2.5">
                  {m.items.map((it) => (
                    <TimelineEntry key={it.key} item={it} showPerson={showPerson} />
                  ))}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
