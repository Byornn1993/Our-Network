import { useState } from 'react';
import type { RelationshipHistory } from '@/lib/db/types';
import { updateHistoryEntry } from '@/lib/actions';
import { todayIso } from '@/domain/dates';
import { DateField, Field } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';

/** Datum en omschrijving van een moment in de relatiegeschiedenis aanpassen. */
export function HistoryEditSheet({ entry, onClose }: { entry: RelationshipHistory; onClose: () => void }) {
  const [date, setDate] = useState(entry.effective_date);
  const [precision, setPrecision] = useState(entry.date_precision);
  const [description, setDescription] = useState(entry.description ?? '');
  return (
    <Sheet
      open
      onClose={onClose}
      title="Moment aanpassen"
      footer={
        <Button
          block
          variant="primary"
          onClick={() => void updateHistoryEntry(entry.id, { effective_date: date || entry.effective_date, date_precision: precision, description: description.trim() || null }).then(onClose)}
        >
          Opslaan
        </Button>
      }
    >
      <div className="space-y-4 p-4">
        <Field label="Vanaf wanneer?">{(id) => <DateField id={id} value={date} precision={precision} onChange={(d, p) => (setDate(d), setPrecision(p))} max={todayIso()} />}</Field>
        <Field label="Omschrijving">{(id) => <input id={id} className="field" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />}</Field>
      </div>
    </Sheet>
  );
}
