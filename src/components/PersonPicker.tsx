import { useMemo, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import { useStore } from '@/lib/db/store';
import { fullName, matchesSearch } from '@/domain/people';
import { Avatar } from './Avatar';

/** Meerdere personen kiezen (zoeken, tikken). Gekozen personen staan bovenaan als chips. */
export function PersonPicker({ value, onChange, exclude = [], single }: { value: string[]; onChange: (ids: string[]) => void; exclude?: string[]; single?: boolean }) {
  const s = useStore();
  const [q, setQ] = useState('');
  const chosen = value.map((id) => s.personById.get(id)).filter((p) => !!p);
  const list = useMemo(
    () =>
      s.persons
        .filter((p) => !exclude.includes(p.id) && matchesSearch(p, q) && (!p.archived_at || value.includes(p.id)))
        .sort((a, b) => fullName(a).localeCompare(fullName(b), 'nl')),
    [s.persons, exclude, q, value],
  );
  const toggle = (id: string) => onChange(single ? (value.includes(id) ? [] : [id]) : value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <div className="space-y-2">
      {chosen.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chosen.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => toggle(p.id)}
              className="flex items-center gap-1.5 rounded-full border border-border bg-surface py-1 pl-1 pr-2 text-sm"
              aria-label={`${fullName(p)} verwijderen`}
            >
              <Avatar path={p.avatar_path} name={fullName(p)} size={22} ring={false} />
              {fullName(p)}
              <X size={14} className="text-muted" />
            </button>
          ))}
        </div>
      )}
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
        <input className="field pl-9" placeholder="Zoek een persoon…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Zoek een persoon" />
      </div>
      <ul className="max-h-60 overflow-y-auto rounded-xl border border-border">
        {list.length === 0 && <li className="p-3 text-sm text-muted">Geen personen gevonden.</li>}
        {list.map((p) => {
          const on = value.includes(p.id);
          const c = s.categoryById.get(p.category_id);
          return (
            <li key={p.id}>
              <button type="button" onClick={() => toggle(p.id)} aria-pressed={on} className="flex min-h-[48px] w-full items-center gap-3 px-3 py-1.5 text-left hover:bg-surface">
                <Avatar path={p.avatar_path} name={fullName(p)} size={32} color={c?.color} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{fullName(p)}</span>
                  <span className="block truncate text-xs text-muted">{c?.name}</span>
                </span>
                <span className={`flex h-6 w-6 items-center justify-center rounded-full border ${on ? 'border-accent bg-accent text-accent-ink' : 'border-border'}`}>{on && <Check size={14} />}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Bjorn / Stephanie aan- of uitvinken. */
export function ProfileToggles({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const s = useStore();
  return (
    <div className="flex gap-2">
      {s.profiles.map((p) => {
        const on = value.includes(p.id);
        return (
          <button
            key={p.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((v) => v !== p.id) : [...value, p.id])}
            className={`flex min-h-[48px] flex-1 items-center gap-2 rounded-xl border px-3 transition ${on ? 'border-accent/60 bg-primary-soft' : 'border-border text-muted'}`}
          >
            <Avatar path={p.avatar_path} name={p.name} size={30} color={on ? 'var(--accent)' : undefined} />
            <span className="flex-1 text-left text-sm font-medium">{p.name}</span>
            <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${on ? 'border-accent bg-accent text-accent-ink' : 'border-border'}`}>{on && <Check size={12} />}</span>
          </button>
        );
      })}
    </div>
  );
}
