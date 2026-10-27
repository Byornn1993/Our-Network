import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, Plus } from 'lucide-react';
import { useStore } from '@/lib/db/store';
import type { Category, GroupKey } from '@/lib/db/types';
import { removeCategory, reorder, saveCategory } from '@/lib/actions';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button, IconButton } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { ColorPicker, Field, IconPicker, Segmented } from '@/components/ui/Form';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { CatIcon } from '@/components/icons';

const GROUPS: { value: GroupKey; label: string }[] = [
  { value: 'family', label: 'Familie' },
  { value: 'friends', label: 'Vrienden' },
  { value: 'colleagues', label: "Collega's" },
  { value: 'acquaintances', label: 'Kennissen' },
  { value: 'other', label: 'Andere' },
];

function Editor({ cat, onClose, nextOrder }: { cat: Category | null; onClose: () => void; nextOrder: number }) {
  const s = useStore();
  const { confirm, dialog } = useConfirm();
  const [f, setF] = useState({
    name: cat?.name ?? '',
    description: cat?.description ?? '',
    color: cat?.color ?? '#62E3B0',
    icon: cat?.icon ?? 'users',
    ring: cat?.ring ?? 3,
    avatar_size: cat?.avatar_size ?? 44,
    group_key: cat?.group_key ?? ('friends' as GroupKey),
  });
  const [error, setError] = useState<string | null>(null);
  const used = cat ? s.persons.filter((p) => p.category_id === cat.id).length : 0;

  const save = async () => {
    const name = f.name.trim();
    if (!name) return setError('Geef de categorie een naam.');
    if (s.categories.some((c) => c.id !== cat?.id && c.name.toLowerCase() === name.toLowerCase())) return setError('Er bestaat al een categorie met die naam.');
    await saveCategory({ ...f, name, description: f.description.trim() || null, display_order: cat?.display_order ?? nextOrder }, cat?.id);
    onClose();
  };

  const remove = async () => {
    if (!cat) return;
    const ok = await confirm({
      title: `${cat.name} verwijderen?`,
      message: used
        ? `${used} ${used === 1 ? 'persoon zit' : 'personen zitten'} in deze categorie. De categorie wordt gearchiveerd: bestaande personen en de geschiedenis blijven ze tonen, maar je kunt ze niet meer kiezen.`
        : 'Deze categorie is leeg en wordt verwijderd.',
      confirmLabel: used ? 'Archiveren' : 'Verwijderen',
      danger: !used,
    });
    if (!ok) return;
    await removeCategory(s, cat);
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={cat ? 'Categorie bewerken' : 'Nieuwe categorie'}
      footer={
        <div className="flex gap-2">
          {cat && (
            <Button variant="danger" onClick={() => void remove()}>
              {used ? 'Archiveren' : 'Verwijderen'}
            </Button>
          )}
          <Button block variant="primary" onClick={() => void save()}>
            Opslaan
          </Button>
        </div>
      }
    >
      <div className="space-y-4 p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: `${f.color}22`, color: f.color, boxShadow: `inset 0 0 0 1.5px ${f.color}` }}>
            <CatIcon name={f.icon} size={22} />
          </span>
          <input className="field" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Bv. Schoonfamilie" aria-label="Naam" maxLength={60} autoFocus={!cat} />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Field label="Omschrijving">{(id) => <input id={id} className="field" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} maxLength={500} />}</Field>
        <Field label="Kleur">{() => <ColorPicker value={f.color} onChange={(color) => setF({ ...f, color })} />}</Field>
        <Field label="Icoon">{() => <IconPicker value={f.icon} onChange={(icon) => setF({ ...f, icon })} color={f.color} />}</Field>
        <Field label="Standaardafstand (ring)" hint="1 = het dichtst bij jullie, 4 = het verst">
          {() => (
            <Segmented
              value={String(f.ring)}
              onChange={(v) => setF({ ...f, ring: Number(v) as 1 | 2 | 3 | 4 })}
              options={['1', '2', '3', '4'].map((v) => ({ value: v, label: `${v}e ring` }))}
            />
          )}
        </Field>
        <Field label={`Grootte profielfoto op de kaart: ${f.avatar_size}`}>
          {(id) => <input id={id} type="range" min={28} max={72} step={2} value={f.avatar_size} onChange={(e) => setF({ ...f, avatar_size: Number(e.target.value) })} className="w-full accent-[var(--accent)]" />}
        </Field>
        <Field label="Hoort bij" hint="Voor filters en statistieken (bv. “Vrienden” in Our Story).">
          {() => (
            <select className="field" value={f.group_key} onChange={(e) => setF({ ...f, group_key: e.target.value as GroupKey })}>
              {GROUPS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>
      {dialog}
    </Sheet>
  );
}

export default function CategoriesSettings() {
  const s = useStore();
  const [params, setParams] = useSearchParams();
  const [edit, setEdit] = useState<Category | 'new' | null>(null);
  useEffect(() => {
    if (params.get('nieuw')) {
      setEdit('new');
      setParams({}, { replace: true });
    }
  }, [params, setParams]);
  const active = s.categories.filter((c) => !c.archived_at);
  const archived = s.categories.filter((c) => c.archived_at);
  const count = (id: string) => s.persons.filter((p) => p.category_id === id && !p.archived_at).length;
  const move = (i: number, d: -1 | 1) => {
    const ids = active.map((c) => c.id);
    const [x] = ids.splice(i, 1);
    ids.splice(i + d, 0, x!);
    void reorder('categories', ids);
  };

  return (
    <div className="mx-auto max-w-2xl px-4 pb-10 md:px-0">
      <PageHeader
        back="/instellingen"
        title="Categorieën"
        subtitle="Kleur, icoon en afstand tot het middelpunt"
        actions={
          <Button size="sm" variant="primary" icon={<Plus size={15} />} onClick={() => setEdit('new')}>
            Nieuw
          </Button>
        }
      />
      <ul className="card mt-2 divide-y divide-border overflow-hidden">
        {active.map((c, i) => (
          <li key={c.id} className="flex items-center gap-2 pr-1">
            <button type="button" onClick={() => setEdit(c)} className="flex min-h-[60px] min-w-0 flex-1 items-center gap-3 px-4 text-left hover:bg-surface">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: `${c.color}22`, color: c.color }}>
                <CatIcon name={c.icon} size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{c.name}</span>
                <span className="block truncate text-xs text-muted">
                  {c.ring}e ring · {count(c.id)} {count(c.id) === 1 ? 'persoon' : 'personen'}
                </span>
              </span>
            </button>
            <IconButton label="Omhoog" disabled={i === 0} onClick={() => move(i, -1)}>
              <ArrowUp size={16} />
            </IconButton>
            <IconButton label="Omlaag" disabled={i === active.length - 1} onClick={() => move(i, 1)}>
              <ArrowDown size={16} />
            </IconButton>
          </li>
        ))}
      </ul>
      {archived.length > 0 && (
        <>
          <h2 className="section-title mt-6">Gearchiveerd</h2>
          <ul className="card divide-y divide-border overflow-hidden opacity-70">
            {archived.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                <span style={{ color: c.color }}>
                  <CatIcon name={c.icon} />
                </span>
                <span className="flex-1">{c.name}</span>
                <Button size="sm" onClick={() => void saveCategory({ ...c }, c.id)}>
                  Herstellen
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}
      {edit && <Editor cat={edit === 'new' ? null : edit} nextOrder={active.length + 1} onClose={() => setEdit(null)} />}
    </div>
  );
}
