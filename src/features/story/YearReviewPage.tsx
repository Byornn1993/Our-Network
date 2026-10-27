import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Camera, HeartHandshake, Home, PartyPopper, Sparkles, Star, TrendingUp, UserPlus } from 'lucide-react';
import { useStore } from '@/lib/db/store';
import { activeYears, yearReview } from '@/domain/stats';
import { globalTimeline } from '@/domain/timeline';
import { yearOf } from '@/domain/dates';
import { fullName } from '@/domain/people';
import { PageHeader } from '@/components/ui/PageHeader';
import { Avatar } from '@/components/Avatar';
import { EmptyState } from '@/components/ui/States';
import { PhotoThumb, TimelineList } from './TimelineList';

export default function YearReviewPage() {
  const { year: yearParam } = useParams();
  const s = useStore();
  const navigate = useNavigate();
  const years = activeYears(s);
  const thisYear = new Date().getFullYear();
  const year = Number(yearParam) || thisYear;
  const options = [...new Set([thisYear, ...years])].sort((a, b) => b - a);
  const r = useMemo(() => yearReview(s, year), [s, year]);
  const items = useMemo(() => globalTimeline(s).filter((i) => yearOf(i.date) === year), [s, year]);
  const highlightEvents = s.events.filter((e) => yearOf(e.event_date) === year && e.is_highlight);
  const yearEventIds = new Set(s.events.filter((e) => yearOf(e.event_date) === year).map((e) => e.id));
  const highlightIds = new Set(highlightEvents.map((e) => e.id));
  // Collage: eerst foto's van hoogtepunten, dan de rest van het jaar
  const photos = s.event_photos
    .filter((p) => yearEventIds.has(p.event_id))
    .sort((a, b) => Number(highlightIds.has(b.event_id)) - Number(highlightIds.has(a.event_id)) || a.display_order - b.display_order)
    .slice(0, 12);

  const rows = [
    { icon: UserPlus, n: r.newPeople.length, label: r.newPeople.length === 1 ? 'nieuwe persoon leren kennen' : 'nieuwe personen leren kennen', color: '#62E3B0' },
    { icon: Home, n: r.byKind.family ?? 0, label: (r.byKind.family ?? 0) === 1 ? 'familiegebeurtenis' : 'familiegebeurtenissen', color: '#E9B949' },
    { icon: Sparkles, n: r.byKind.memory ?? 0, label: (r.byKind.memory ?? 0) === 1 ? 'belangrijke herinnering' : 'belangrijke herinneringen', color: '#C9A7F5' },
    { icon: HeartHandshake, n: (r.byKind.new_relationship ?? 0) + r.closer, label: (r.byKind.new_relationship ?? 0) + r.closer === 1 ? 'relatie die dichterbij kwam' : 'relaties die dichterbij kwamen', color: '#F26B1D' },
    { icon: PartyPopper, n: r.byKind.friendship ?? 0, label: (r.byKind.friendship ?? 0) === 1 ? 'vriendschapsmoment' : 'vriendschapsmomenten', color: '#F5A266' },
    { icon: Camera, n: r.photoCount, label: r.photoCount === 1 ? 'foto bewaard' : "foto's bewaard", color: '#6BB8E8' },
  ].filter((x) => x.n > 0);

  return (
    <div className="mx-auto max-w-3xl px-4 pb-10 md:px-0">
      <PageHeader back="/story" title="Jaaroverzicht" subtitle="Ons jaar in beeld" />
      <select className="field mt-1 w-40" value={year} onChange={(e) => navigate(`/story/jaar/${e.target.value}`, { replace: true })} aria-label="Kies een jaar">
        {options.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>

      {items.length === 0 && r.newPeople.length === 0 ? (
        <EmptyState icon={<Sparkles />} title={`Nog niets in ${year}`} text="Voeg herinneringen of personen met een datum in dit jaar toe, dan verschijnt hier jullie jaaroverzicht." />
      ) : (
        <>
          <section className="card relative mt-4 overflow-hidden p-5">
            <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(233,185,73,0.18),transparent_70%)]" />
            <h2 className="text-xl font-bold">Ons netwerk in {year}</h2>
            <p className="text-sm text-muted">
              {r.eventCount} {r.eventCount === 1 ? 'moment' : 'momenten'} bewaard
            </p>
            {rows.length > 0 && (
              <ul className="mt-4 space-y-2.5">
                {rows.map((x) => (
                  <li key={x.label} className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: `${x.color}22`, color: x.color }}>
                      <x.icon size={16} />
                    </span>
                    <span className="w-8 text-lg font-semibold tabular-nums">{x.n}</span>
                    <span className="text-sm text-muted">{x.label}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {photos.length > 0 && (
            <section className="mt-6">
              <h2 className="section-title flex items-center gap-1.5">
                <Star size={13} /> Hoogtepunten in beeld
              </h2>
              <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
                {photos.map((p) => (
                  <Link key={p.id} to={`/story/${p.event_id}`} className="shrink-0" aria-label={s.eventById.get(p.event_id)?.title}>
                    <PhotoThumb photo={p} size={132} />
                    <span className="mt-1 block w-[132px] truncate text-xs text-muted">{s.eventById.get(p.event_id)?.title}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {r.newPeople.length > 0 && (
            <section className="mt-6">
              <h2 className="section-title">Nieuw in ons leven</h2>
              <div className="no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4 md:mx-0 md:px-0">
                {r.newPeople.map((p) => (
                  <Link key={p.id} to={`/personen/${p.id}`} className="flex w-16 shrink-0 flex-col items-center text-center">
                    <Avatar path={p.avatar_path} name={fullName(p)} size={56} color={s.categoryById.get(p.category_id)?.color} />
                    <span className="mt-1 line-clamp-2 text-xs">{p.first_name}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {items.length > 0 && (
            <section className="mt-6">
              <h2 className="section-title flex items-center gap-1.5">
                <TrendingUp size={13} /> Het jaar in volgorde
              </h2>
              <TimelineList items={items} />
            </section>
          )}
        </>
      )}
    </div>
  );
}
