import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Archive, ChevronRight, LayoutGrid, List, Search, UserPlus, Users } from 'lucide-react';
import { useStore, type Store } from '@/lib/db/store';
import { usePref, type Prefs } from '@/lib/prefs';
import type { Person } from '@/lib/db/types';
import { connectionLabel, connectionSide, fullName, matchesSearch, ringOf } from '@/domain/people';
import { PageHeader, Chip } from '@/components/ui/PageHeader';
import { IconButton } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/States';
import { Avatar } from '@/components/Avatar';
import { Badge } from '@/components/ui/Form';

export function relationText(s: Store, p: Person): string {
  const descs = s.person_connections.filter((c) => c.person_id === p.id && c.description).map((c) => c.description);
  if (descs.length) return descs.join(' · ');
  const side = connectionSide(p.id, s.person_connections, s.profiles);
  return side === 'none' ? '' : `Verbonden met ${connectionLabel(side, s.profiles)}`;
}

const SORTS: { value: Prefs['personsSort']; label: string }[] = [
  { value: 'name', label: 'Naam' },
  { value: 'category', label: 'Categorie' },
  { value: 'recent', label: 'Recent toegevoegd' },
  { value: 'met', label: 'Leren kennen' },
];

export default function PersonsPage() {
  const s = useStore();
  const navigate = useNavigate();
  const [view, setView] = usePref('personsView');
  const [sort, setSort] = usePref('personsSort');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const [who, setWho] = useState<'all' | 'bjorn' | 'stephanie' | 'both'>('all');
  const [archived, setArchived] = useState(false);

  const list = useMemo(() => {
    const out = s.persons.filter(
      (p) =>
        !!p.archived_at === archived &&
        (!cat || p.category_id === cat) &&
        matchesSearch(p, q) &&
        (who === 'all' || (() => {
          const side = connectionSide(p.id, s.person_connections, s.profiles);
          return who === 'both' ? side === 'both' : side === who || side === 'both';
        })()),
    );
    const name = (a: Person, b: Person) => fullName(a).localeCompare(fullName(b), 'nl');
    const order = (p: Person) => s.categoryById.get(p.category_id)?.display_order ?? 99;
    return out.sort((a, b) =>
      sort === 'category'
        ? order(a) - order(b) || name(a, b)
        : sort === 'recent'
          ? b.created_at.localeCompare(a.created_at)
          : sort === 'met'
            ? (b.first_met_at ?? '0').localeCompare(a.first_met_at ?? '0') || name(a, b)
            : name(a, b),
    );
  }, [s, q, cat, who, archived, sort]);

  const archivedCount = s.persons.filter((p) => p.archived_at).length;

  return (
    <div className="px-4 md:px-0">
      <PageHeader
        title="Personen"
        subtitle={`${s.persons.filter((p) => !p.archived_at).length} mensen in ons netwerk`}
        actions={
          <>
            <IconButton label={view === 'list' ? 'Rasterweergave' : 'Lijstweergave'} onClick={() => setView(view === 'list' ? 'grid' : 'list')}>
              {view === 'list' ? <LayoutGrid size={20} /> : <List size={20} />}
            </IconButton>
            <IconButton label="Nieuwe persoon" onClick={() => navigate('/personen/nieuw')} className="text-accent">
              <UserPlus size={20} />
            </IconButton>
          </>
        }
      />

      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
        <input className="field rounded-full pl-9" placeholder="Zoek personen…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Zoek personen" />
      </div>

      <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        <Chip active={!cat} onClick={() => setCat(null)}>
          Alle
        </Chip>
        {s.categories.filter((c) => !c.archived_at).map((c) => (
          <Chip key={c.id} active={cat === c.id} onClick={() => setCat(cat === c.id ? null : c.id)}>
            <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: c.color }} />
            {c.name}
          </Chip>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <select className="field w-auto py-1.5 text-sm" value={who} onChange={(e) => setWho(e.target.value as typeof who)} aria-label="Filter op verbinding">
          <option value="all">Iedereen</option>
          <option value="bjorn">Van {s.profiles[0]?.name ?? 'Bjorn'}</option>
          <option value="stephanie">Van {s.profiles[1]?.name ?? 'Stephanie'}</option>
          <option value="both">Gemeenschappelijk</option>
        </select>
        <select className="field w-auto py-1.5 text-sm" value={sort} onChange={(e) => setSort(e.target.value as Prefs['personsSort'])} aria-label="Sorteren">
          {SORTS.map((o) => (
            <option key={o.value} value={o.value}>
              Sorteer: {o.label}
            </option>
          ))}
        </select>
        {(archivedCount > 0 || archived) && (
          <Chip active={archived} onClick={() => setArchived(!archived)}>
            <Archive size={13} className="mr-1 inline" /> Gearchiveerd ({archivedCount})
          </Chip>
        )}
      </div>

      {list.length === 0 ? (
        s.persons.length === 0 ? (
          <EmptyState
            icon={<Users />}
            title="Nog niemand toegevoegd"
            text="Begin met de mensen die het dichtst bij jullie staan."
            action={
              <Link to="/personen/nieuw" className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-accent px-4 font-semibold text-accent-ink">
                <UserPlus size={18} /> Persoon toevoegen
              </Link>
            }
          />
        ) : (
          <EmptyState icon={<Search />} title="Geen resultaten" text="Pas je zoekopdracht of filters aan." />
        )
      ) : view === 'list' ? (
        <ul className="card mt-4 divide-y divide-border overflow-hidden">
          {list.map((p) => {
            const c = s.categoryById.get(p.category_id);
            const rel = relationText(s, p);
            return (
              <li key={p.id}>
                <Link to={`/personen/${p.id}`} className="flex min-h-[64px] items-center gap-3 px-3 py-2 transition hover:bg-surface">
                  <Avatar path={p.avatar_path} name={fullName(p)} size={44} color={c?.color} muted={!!p.archived_at} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{fullName(p)}</span>
                    <span className="block truncate text-xs text-muted">{[c?.name, rel || p.description].filter(Boolean).join(' – ')}</span>
                  </span>
                  <span className="hidden sm:block">{c && <Badge color={c.color} size="sm">{ringOf(p, c)}e ring</Badge>}</span>
                  <ChevronRight size={18} className="text-faint" />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {list.map((p) => {
            const c = s.categoryById.get(p.category_id);
            return (
              <li key={p.id}>
                <Link to={`/personen/${p.id}`} className="card flex h-full flex-col items-center p-4 text-center transition hover:border-accent/40">
                  <Avatar path={p.avatar_path} name={fullName(p)} size={72} color={c?.color} muted={!!p.archived_at} />
                  <span className="mt-3 line-clamp-1 font-medium">{fullName(p)}</span>
                  {c && (
                    <span className="mt-1">
                      <Badge color={c.color} icon={c.icon} size="sm">
                        {c.name}
                      </Badge>
                    </span>
                  )}
                  {(relationText(s, p) || p.description) && <span className="mt-2 line-clamp-2 text-xs text-muted">{relationText(s, p) || p.description}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
