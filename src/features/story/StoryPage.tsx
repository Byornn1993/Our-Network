import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookHeart, CalendarPlus, Search, SlidersHorizontal, X } from 'lucide-react';
import { useStore } from '@/lib/db/store';
import { usePref } from '@/lib/prefs';
import { monthName } from '@/domain/dates';
import { fullName } from '@/domain/people';
import { applyFilter, EMPTY_FILTER, globalTimeline, yearsWithItems, type KindFilter, type TimelineFilter, type WhoFilter } from '@/domain/timeline';
import { Chip } from '@/components/ui/PageHeader';
import { Toggle } from '@/components/ui/Form';
import { EmptyState } from '@/components/ui/States';
import { SubNav } from '@/features/network/SubNav';
import { TimelineList } from './TimelineList';

const KINDS: { value: KindFilter; label: string }[] = [
  { value: 'family', label: 'Familie' },
  { value: 'friends', label: 'Vrienden' },
  { value: 'colleagues', label: "Collega's" },
  { value: 'acquaintances', label: 'Kennissen' },
  { value: 'first_meeting', label: 'Eerste ontmoetingen' },
  { value: 'birthday', label: 'Verjaardagen' },
  { value: 'highlight', label: 'Belangrijke momenten' },
];

export default function StoryPage() {
  const s = useStore();
  const [showChanges, setShowChanges] = usePref('storyShowChanges');
  const [defaultWho] = usePref('storyDefaultWho');
  const [f, setF] = useState<TimelineFilter>({ ...EMPTY_FILTER, who: defaultWho });
  const [more, setMore] = useState(false);

  const all = useMemo(() => globalTimeline(s, { includeChanges: showChanges }), [s, showChanges]);
  const years = useMemo(() => yearsWithItems(all), [all]);
  const items = useMemo(() => applyFilter(s, all, f), [s, all, f]);
  const set = <K extends keyof TimelineFilter>(k: K, v: TimelineFilter[K]) => setF((x) => ({ ...x, [k]: v }));
  const b = s.profiles[0]?.name ?? 'Bjorn';
  const st = s.profiles[1]?.name ?? 'Stephanie';
  const filtered = JSON.stringify({ ...f, who: 'all' }) !== JSON.stringify({ ...EMPTY_FILTER, who: 'all' }) || f.who !== 'all';

  return (
    <div className="mx-auto max-w-3xl px-4 pb-8 pt-4 md:px-0">
      <SubNav />
      <header className="mt-3 flex items-start gap-3 md:mt-6">
        <div className="min-w-0 flex-1">
          <h1 className="text-[28px] font-bold leading-tight tracking-tight md:text-3xl">Our Story</h1>
          <p className="mt-0.5 text-sm text-muted">De mensen, ontmoetingen en momenten die ons verhaal vormen.</p>
        </div>
        <Link to="/story/nieuw" className="flex min-h-[44px] items-center gap-2 rounded-full bg-accent px-4 text-sm font-semibold text-accent-ink">
          <CalendarPlus size={17} /> <span className="hidden sm:inline">Moment</span>
        </Link>
      </header>

      <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0" role="group" aria-label="Wie">
        {(
          [
            ['all', 'Alles'],
            ['bjorn', b],
            ['stephanie', st],
            ['common', 'Gemeenschappelijk'],
          ] as [WhoFilter, string][]
        ).map(([v, l]) => (
          <Chip key={v} active={f.who === v} onClick={() => set('who', v)}>
            {l}
          </Chip>
        ))}
        <Chip active={more} onClick={() => setMore(!more)}>
          <SlidersHorizontal size={13} className="mr-1 inline" /> Filters
        </Chip>
      </div>

      {years.length > 0 && (
        <div className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0" role="group" aria-label="Jaar">
          <Chip active={f.year === null} onClick={() => setF((x) => ({ ...x, year: null, month: null }))}>
            Alle jaren
          </Chip>
          {years.map((y) => (
            <Chip key={y} active={f.year === y} onClick={() => setF((x) => ({ ...x, year: x.year === y ? null : y, month: null }))}>
              {y}
            </Chip>
          ))}
        </div>
      )}

      {more && (
        <div className="card mt-3 space-y-3 p-3">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <input className="field pl-9" placeholder="Zoek in gebeurtenissen…" value={f.query} onChange={(e) => set('query', e.target.value)} aria-label="Zoek in gebeurtenissen" />
          </div>
          <div className="flex flex-wrap gap-2">
            {KINDS.map((k) => (
              <Chip key={k.value} active={f.kind === k.value} onClick={() => set('kind', f.kind === k.value ? 'all' : k.value)}>
                {k.label}
              </Chip>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <select className="field" value={f.personId ?? ''} onChange={(e) => set('personId', e.target.value || null)} aria-label="Betrokken persoon">
              <option value="">Alle personen</option>
              {[...s.persons].sort((a, c) => fullName(a).localeCompare(fullName(c), 'nl')).map((p) => (
                <option key={p.id} value={p.id}>
                  {fullName(p)}
                </option>
              ))}
            </select>
            <select className="field" value={f.month ?? ''} disabled={f.year === null} onChange={(e) => set('month', e.target.value ? Number(e.target.value) : null)} aria-label="Maand">
              <option value="">{f.year === null ? 'Kies eerst een jaar' : 'Alle maanden'}</option>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={i + 1}>
                  {monthName(i + 1)}
                </option>
              ))}
            </select>
          </div>
          <Toggle checked={showChanges} onChange={setShowChanges} label="Relatiewijzigingen tonen" hint="Bv. “Kennissen → Goede vrienden”" />
          {filtered && (
            <button type="button" className="flex items-center gap-1 text-sm text-muted hover:text-text" onClick={() => setF({ ...EMPTY_FILTER })}>
              <X size={14} /> Alle filters wissen
            </button>
          )}
        </div>
      )}

      <div className="mt-5">
        {all.length === 0 ? (
          <EmptyState
            icon={<BookHeart />}
            title="Jullie verhaal begint hier"
            text="Voeg een eerste herinnering toe: een ontmoeting, een reis, een feest. Ook momenten van jaren geleden."
            action={
              <Link to="/story/nieuw" className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-accent px-4 font-semibold text-accent-ink">
                <CalendarPlus size={18} /> Eerste moment toevoegen
              </Link>
            }
          />
        ) : items.length === 0 ? (
          <EmptyState icon={<Search />} title="Niets gevonden" text="Geen momenten die aan deze filters voldoen." />
        ) : (
          <TimelineList items={items} />
        )}
      </div>
    </div>
  );
}
