import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useStore } from '@/lib/db/store';
import type { EventPhoto } from '@/lib/db/types';
import { updatePhoto } from '@/lib/actions';
import { useSignedUrl } from '@/lib/images';
import { Field } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { PersonPicker } from '@/components/PersonPicker';
import { PhotoThumb } from './TimelineList';

// Foto's van een moment: tegel (vult het vak) en het blad om bijschrift en personen aan te passen.

export function PhotoEditSheet({ photo, onClose, onDelete }: { photo: EventPhoto; onClose: () => void; onDelete: () => void }) {
  const s = useStore();
  const [caption, setCaption] = useState(photo.caption ?? '');
  const [persons, setPersons] = useState(s.photo_persons.filter((p) => p.photo_id === photo.id).map((p) => p.person_id));
  return (
    <Sheet
      open
      onClose={onClose}
      title="Foto"
      footer={
        <div className="flex gap-2">
          <Button variant="danger" icon={<Trash2 size={16} />} onClick={onDelete}>
            Verwijderen
          </Button>
          <Button block variant="primary" onClick={() => void updatePhoto(s, photo.id, caption.trim() || null, persons).then(onClose)}>
            Opslaan
          </Button>
        </div>
      }
    >
      <div className="space-y-4 p-4">
        <div className="flex justify-center">
          <PhotoThumb photo={photo} size={160} />
        </div>
        <Field label="Bijschrift">{(id) => <input id={id} className="field" value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={500} />}</Field>
        <Field label="Wie staat erop?">{() => <PersonPicker value={persons} onChange={setPersons} />}</Field>
      </div>
    </Sheet>
  );
}

export function PhotoFill({ photo }: { photo: EventPhoto }) {
  const url = useSignedUrl(photo.thumb_path ?? photo.storage_path);
  return <span className="block h-full w-full bg-surface-2">{url && <img src={url} alt={photo.caption ?? ''} className="h-full w-full object-cover" loading="lazy" />}</span>;
}
