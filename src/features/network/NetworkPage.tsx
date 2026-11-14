import { useMemo, useState } from 'react';
import { tint } from '@/lib/color';
import { Link, useNavigate } from 'react-router-dom';
import { BookHeart, Check, GitBranch, Move, RotateCcw, Search, UserPlus, X } from 'lucide-react';
import { useStore } from '@/lib/db/store';
import { usePref } from '@/lib/prefs';
import { connectionLabel, connectionSide, fullName, matchesSearch, ringOf } from '@/domain/people';
import { resetPositions, savePosition } from '@/lib/actions';
import { IconButton, Button } from '@/components/ui/Button';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { Chip } from '@/components/ui/PageHeader';
import { Avatar } from '@/components/Avatar';
import { NetworkMap, type MapPerson } from './NetworkMap';
import { SubNav } from './SubNav';
import { isReadOnly } from '@/lib/backend';

export default function NetworkPage() {
  const s = useStore();
  const navigate = useNavigate();
  const { confirm, dialog } = useConfirm();
  const [hidden, setHidden] = usePref('mapHiddenCategories');
  const [showRelations, setShowRelations] = usePref('mapShowRelations');
  const [showLabels] = usePref('mapShowLabels');
  const [editMode, setEditMode] = useState(false);
  const [query, setQuery] = useState('');
  const [focusId, setFocusId] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState(0);

  const active = useMemo(() => s.persons.filter((p) => !p.archived_at), [s.persons]);

  // Partners: elk koppel komt naast elkaar op de kaart.
  const partnerOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of s.relationships) {
      if (r.relationship_type !== 'partner') continue;
      if (!m.has(r.person_id)) m.set(r.person_id, r.related_person_id);
      if (!m.has(r.related_person_id)) m.set(r.related_person_id, r.person_id);
    }
    return m;
  }, [s.relationships]);

  const mapPersons: MapPerson[] = useMemo(() => {
    const firstNames = new Map<string, number>();
    active.forEach((p) => firstNames.set(p.first_name, (firstNames.get(p.first_name) ?? 0) + 1));
    return active
      .filter((p) => !hidden.includes(p.category_id))
      .map((p) => {
        const c = s.categoryById.get(p.category_id);
        const side = connectionSide(p.id, s.person_connections, s.profiles);
        const dup = (firstNames.get(p.first_name) ?? 0) > 1 && p.last_name;
        return {
          id: p.id,
          name: fullName(p),
          label: dup ? `${p.first_name} ${p.last_name![0]}.` : p.first_name,
          avatarPath: p.avatar_path,
          color: c?.color ?? '#7C8FA3',
          size: c?.avatar_size ?? 40,
          ring: ringOf(p, c),
          order: c?.display_order ?? 99,
          partnerId: partnerOf.get(p.id) ?? null,
          side,
          subtitle: [c?.name, side !== 'none' ? `via ${connectionLabel(side, s.profiles)}` : null, p.description].filter(Boolean).join(' · '),
        };
      });
  }, [active, hidden, partnerOf, s.categoryById, s.person_connections, s.profiles]);

  const manual = useMemo(() => new Map(s.network_positions.map((p) => [p.person_id, { x: p.x_position, y: p.y_position }])), [s.network_positions]);

  // Partners zijn altijd verbonden; andere relaties enkel als "relaties tonen" aan staat.
  const relations = useMemo(() => {
    const shown = new Set(mapPersons.map((p) => p.id));
    return s.relationships
      .filter((r) => shown.has(r.person_id) && shown.has(r.related_person_id) && (showRelations || r.relationship_type === 'partner'))
      .map((r) => ({ a: r.person_id, b: r.related_person_id, partner: r.relationship_type === 'partner' }));
  }, [showRelations, mapPersons, s.relationships]);

  const results = query.trim() ? active.filter((p) => matchesSearch(p, query)).slice(0, 6) : [];

  const toggleCategory = (id: string) => setHidden(hidden.includes(id) ? hidden.filter((h) => h !== id) : [...hidden, id]);
  const usedCategories = s.categories.filter((c) => !c.archived_at || active.some((p) => p.category_id === c.id));

  const counts = new Map<string, number>();
  active.forEach((p) => counts.set(p.category_id, (counts.get(p.category_id) ?? 0) + 1));

  const reset = async () => {
    if (!s.network_positions.length) return setResetToken((t) => t + 1);
    const ok = await confirm({
      title: 'Posities resetten?',
      message: `${s.network_positions.length} handmatig verplaatste ${s.network_positions.length === 1 ? 'persoon gaat' : 'personen gaan'} terug naar de automatische plaats. Dit geldt ook op het toestel van de ander.`,
      confirmLabel: 'Resetten',
    });
    if (!ok) return;
    await resetPositions(s);
    setResetToken((t) => t + 1);
  };

  return (
    <div className="flex h-[calc(100dvh-var(--nav-h)-var(--safe-bottom)-var(--safe-top))] flex-col md:h-dvh">
      <div className="shrink-0 px-4 pt-4 md:px-8">
        <SubNav />
        <header className="mt-3 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-[28px] font-bold leading-tight tracking-tight md:text-3xl">Ons Netwerk</h1>
            <p className="mt-0.5 text-sm text-muted">De mensen die ons leven rijker maken</p>
            <div className="mt-2 h-0.5 w-8 rounded-full bg-accent" />
          </div>
          <Link to="/personen/nieuw" aria-label="Nieuwe persoon" className="tap flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-text hover:border-accent/50">
            <UserPlus size={20} />
          </Link>
        </header>

        <div className="relative mt-3">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input
            className="field rounded-full pl-9 pr-10"
            placeholder="Zoek een persoon…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Zoek een persoon op de kaart"
          />
          {query && (
            <button type="button" aria-label="Zoekopdracht wissen" className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center text-muted" onClick={() => (setQuery(''), setFocusId(null))}>
              <X size={16} />
            </button>
          )}
          {results.length > 0 && (
            <ul className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
              {results.map((p) => {
                const c = s.categoryById.get(p.category_id);
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      className="flex min-h-[48px] w-full items-center gap-3 px-3 text-left hover:bg-surface"
                      onClick={() => {
                        if (hidden.includes(p.category_id)) setHidden(hidden.filter((h) => h !== p.category_id));
                        setFocusId(p.id);
                        setQuery('');
                      }}
                    >
                      <Avatar path={p.avatar_path} name={fullName(p)} size={30} color={c?.color} />
                      <span className="flex-1 truncate text-sm">{fullName(p)}</span>
                      <span className="text-xs text-muted">{c?.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0" role="group" aria-label="Categorieën tonen of verbergen">
          <Chip active={hidden.length === 0} onClick={() => setHidden([])}>
            Alle
          </Chip>
          {usedCategories.map((c) => {
            const on = !hidden.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggleCategory(c.id)}
                className={`flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm transition ${on ? 'border-border text-text' : 'border-transparent text-faint line-through'}`}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color, opacity: on ? 1 : 0.35 }} />
                {c.name}
                <span className="text-xs text-faint">{counts.get(c.id) ?? 0}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        <NetworkMap
          persons={mapPersons}
          manual={manual}
          relations={relations}
          profiles={s.profiles}
          editMode={editMode}
          showLabels={showLabels}
          focusId={focusId}
          resetToken={resetToken}
          onOpen={(id) => navigate(`/personen/${id}`)}
          onOpenHub={() => navigate('/instellingen/profielen')}
          onMove={(id, x, y) => void savePosition(id, x, y)}
          controls={
            <>
              <IconButton label={showRelations ? 'Onderlinge relaties verbergen' : 'Onderlinge relaties tonen'} onClick={() => setShowRelations(!showRelations)} className={showRelations ? 'text-accent' : ''}>
                <GitBranch size={17} />
              </IconButton>
            </>
          }
        />

        {/* Zelf verplaatsen: duidelijke knop bovenaan de kaart */}
        {active.length > 0 &&
          !isReadOnly() &&
          (editMode ? (
            <div className="absolute inset-x-3 top-2 mx-auto flex max-w-md items-center gap-2 rounded-2xl border border-accent/50 bg-card/95 p-2 pl-3 text-sm shadow-xl backdrop-blur">
              <Move size={16} className="shrink-0 text-accent" />
              <span className="min-w-0 flex-1 leading-tight">
                Sleep iemand naar een nieuwe plek<span className="hidden sm:inline">. Wordt bewaard, ook voor de ander</span>.
              </span>
              <Button size="sm" onClick={() => void reset()} icon={<RotateCcw size={14} />} aria-label="Alle posities terugzetten">
                Reset
              </Button>
              <Button size="sm" variant="primary" onClick={() => setEditMode(false)} icon={<Check size={14} />}>
                Klaar
              </Button>
            </div>
          ) : (
            <Button size="sm" className="absolute left-3 top-2 shadow-lg md:left-4" onClick={() => setEditMode(true)} icon={<Move size={15} />}>
              Verplaatsen
            </Button>
          ))}

        {active.length === 0 && (
          <div className="absolute inset-x-4 bottom-4 mx-auto max-w-sm rounded-2xl border border-border bg-card/95 p-4 text-center shadow-xl backdrop-blur">
            <p className="font-semibold">Jullie netwerk is nog leeg</p>
            <p className="mt-1 text-sm text-muted">Voeg de eerste persoon toe. Familie komt het dichtst bij het middelpunt.</p>
            <Button variant="primary" className="mt-3" onClick={() => navigate('/personen/nieuw')} icon={<UserPlus size={16} />}>
              Persoon toevoegen
            </Button>
          </div>
        )}
      </div>

      {/* legende */}
      <div className="shrink-0 px-4 pb-3 md:px-8 md:pb-5">
        <div className="card no-scrollbar flex items-center gap-x-5 gap-y-2 overflow-x-auto px-4 py-2.5 md:flex-wrap md:py-3">
          {usedCategories.map((c) => (
            <span key={c.id} className="flex shrink-0 items-center gap-2 text-[13px] md:text-sm">
              <span className="h-3 w-3 rounded-full" style={{ background: c.color, boxShadow: `0 0 8px ${tint(c.color, 0.5)}` }} />
              <span>{c.name}</span>
              <span className="text-xs text-faint">({c.ring}e ring)</span>
            </span>
          ))}
          <Link to="/story" className="ml-auto hidden items-center gap-1.5 text-sm text-accent hover:underline sm:flex">
            <BookHeart size={15} /> Our Story
          </Link>
        </div>
      </div>
      {dialog}
    </div>
  );
}
