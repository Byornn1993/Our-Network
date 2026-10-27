import { useState } from 'react';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { Field, Segmented } from '@/components/ui/Form';
import { PersonPicker } from '@/components/PersonPicker';
import { useStore } from '@/lib/db/store';
import type { Relationship, RelationshipType } from '@/lib/db/types';
import { deleteRelationship, saveRelationship } from '@/lib/actions';
import { RELATIONSHIP_LABEL } from '@/domain/people';

const TYPES = Object.entries(RELATIONSHIP_LABEL).map(([value, label]) => ({ value: value as RelationshipType, label }));

/** Relatie tussen twee personen vastleggen (partner, familie, vriend, collega, andere). */
export function RelationshipSheet({ open, onClose, personId, edit }: { open: boolean; onClose: () => void; personId?: string; edit?: Relationship }) {
  return open ? <Inner onClose={onClose} personId={personId} edit={edit} /> : null;
}

function Inner({ onClose, personId, edit }: { onClose: () => void; personId?: string; edit?: Relationship }) {
  const s = useStore();
  const [a, setA] = useState<string[]>(edit ? [edit.person_id] : personId ? [personId] : []);
  const [b, setB] = useState<string[]>(edit ? [edit.related_person_id] : []);
  const [type, setType] = useState<RelationshipType>(edit?.relationship_type ?? 'friend');
  const [description, setDescription] = useState(edit?.description ?? '');
  const [since, setSince] = useState(edit?.since_date ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!a[0] || !b[0]) return setError('Kies twee personen.');
    if (a[0] === b[0]) return setError('Kies twee verschillende personen.');
    setBusy(true);
    if (edit && edit.relationship_type !== type) await deleteRelationship(edit.id);
    await saveRelationship(s, {
      id: edit && edit.relationship_type === type ? edit.id : undefined,
      personId: a[0],
      relatedId: b[0],
      type,
      description: description.trim() || null,
      since: since || null,
    });
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={edit ? 'Relatie bewerken' : 'Nieuwe relatie'}
      footer={
        <div className="flex gap-2">
          {edit && (
            <Button variant="danger" onClick={() => void deleteRelationship(edit.id).then(onClose)}>
              Verwijderen
            </Button>
          )}
          <Button block variant="primary" loading={busy} onClick={() => void save()}>
            Opslaan
          </Button>
        </div>
      }
    >
      <div className="space-y-4 p-4">
        {s.persons.length < 2 ? (
          <p className="text-sm text-muted">Voeg eerst minstens twee personen toe.</p>
        ) : (
          <>
            {!personId && !edit && <Field label="Persoon">{() => <PersonPicker value={a} onChange={setA} single exclude={b} />}</Field>}
            {(personId || edit) && a[0] && <p className="text-sm text-muted">Relatie van <b className="text-text">{s.personById.get(a[0])?.first_name}</b> met…</p>}
            <Field label={personId || edit ? 'Andere persoon' : 'Verbonden met'}>{() => <PersonPicker value={b} onChange={setB} single exclude={a} />}</Field>
            <Field label="Soort relatie">{() => <Segmented size="sm" value={type} onChange={setType} options={TYPES} />}</Field>
            <Field label="Omschrijving (optioneel)">
              {(id) => <input id={id} className="field" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Bv. getrouwd sinds 2021, broers, zelfde team" maxLength={200} />}
            </Field>
            <Field label="Sinds (optioneel)">{(id) => <input id={id} type="date" className="field" value={since} onChange={(e) => setSince(e.target.value)} />}</Field>
            {error && <p className="text-sm text-danger">{error}</p>}
          </>
        )}
      </div>
    </Sheet>
  );
}
