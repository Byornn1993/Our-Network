import { useState } from 'react';
import { tint } from '@/lib/color';
import { ArrowDown, ArrowUp, Plus } from 'lucide-react';
import { useStore } from '@/lib/db/store';
import type { EventCategory } from '@/lib/db/types';
import { removeEventCategory, reorder, saveEventCategory } from '@/lib/actions';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button, IconButton } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { ColorPicker, Field, IconPicker } from '@/components/ui/Form';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { CatIcon } from '@/components/icons';

function Editor({ cat, onClose, nextOrder }: { cat: EventCategory | null; onClose: () => void; nextOrder: number }) {
  const s = useStore();
  const { confirm, dialog } = useConfirm();
  const [name, setName] = useState(cat?.name ?? '');
  const [color, setColor] = useState(cat?.color ?? '#C9A7F5');
  const [icon, setIcon] = useState(cat?.icon ?? 'sparkles');
  const [error, setError] = useState<string | null>(null);
  const used = cat ? s.events.filter((e) => e.event_category_id === cat.id).length : 0;

  const save = async () => {
    const n = name.trim();
    if (!n) return setError('Geef het type een naam.');
    if (s.event_categories.some((c) => c.id !== cat?.id && c.name.toLowerCase() === n.toLowerCase())) return setError('Dit type bestaat al.');
    await saveEventCategory({ name: n, color, icon, display_order: cat?.display_order ?? nextOrder }, cat?.id);
    onClose();
  };

  const remove = async () => {
    if (!cat) return;
    const archive = used > 0 || !!cat.system_key;
    const ok = await confirm({
      title: `${cat.name} ${archive ? 'archiveren' : 'verwijderen'}?`,
      message: archive
        ? `Bestaande momenten (${used}) houden dit type, maar je kunt het niet meer kiezen voor nieuwe momenten.${cat.system_key ? ' Dit is een standaardtype; je kunt het later herstellen.' : ''}`
        : 'Dit type wordt nog nergens gebruikt en wordt verwijderd.',
      confirmLabel: archive ? 'Archiveren' : 'Verwijderen',
      danger: !archive,
    });
    if (!ok) return;
    await removeEventCategory(s, cat);
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={cat ? 'Type bewerken' : 'Nieuw gebeurtenistype'}
      footer={
        <div className="flex gap-2">
          {cat && (
            <Button variant="danger" onClick={() => void remove()}>
              {used || cat.system_key ? 'Archiveren' : 'Verwijderen'}
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
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" style={{ background: tint(color, 0.13), color, boxShadow: `inset 0 0 0 1.5px ${color}` }}>
            <CatIcon name={icon} size={22} />
          </span>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Bv. Gezamenlijke uitstap" aria-label="Naam" maxLength={60} autoFocus={!cat} />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Field label="Kleur">{() => <ColorPicker value={color} onChange={setColor} />}</Field>
        <Field label="Icoon">{() => <IconPicker value={icon} onChange={setIcon} color={color} />}</Field>
      </div>
      {dialog}
    </Sheet>
  );
}

export default function EventTypesSettings() {
  const s = useStore();
  const [edit, setEdit] = useState<EventCategory | 'new' | null>(null);
  const active = s.event_categories.filter((c) => !c.archived_at);
  const archived = s.event_categories.filter((c) => c.archived_at);
  const move = (i: number, d: -1 | 1) => {
    const ids = active.map((c) => c.id);
    const [x] = ids.splice(i, 1);
    ids.splice(i + d, 0, x!);
    void reorder('event_categories', ids);
  };
  return (
    <div className="mx-auto max-w-2xl px-4 pb-10 md:px-0">
      <PageHeader
        back="/instellingen"
        title="Gebeurtenistypes"
        subtitle="Soorten momenten in Our Story"
        actions={
          <Button size="sm" variant="primary" icon={<Plus size={15} />} onClick={() => setEdit('new')}>
            Nieuw
          </Button>
        }
      />
      <ul className="card mt-2 divide-y divide-border overflow-hidden">
        {active.map((c, i) => (
          <li key={c.id} className="flex items-center gap-2 pr-1">
            <button type="button" onClick={() => setEdit(c)} className="flex min-h-[56px] min-w-0 flex-1 items-center gap-3 px-4 text-left hover:bg-surface">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: tint(c.color, 0.13), color: c.color }}>
                <CatIcon name={c.icon} size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{c.name}</span>
                <span className="block text-xs text-muted">{s.events.filter((e) => e.event_category_id === c.id).length} momenten</span>
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
                <Button size="sm" onClick={() => void saveEventCategory({ name: c.name, color: c.color, icon: c.icon, display_order: c.display_order }, c.id)}>
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
