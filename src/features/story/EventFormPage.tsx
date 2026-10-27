import { useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ImagePlus, Lock, Star, X } from 'lucide-react';
import { useStore } from '@/lib/db/store';
import { newId } from '@/lib/db/repo';
import type { DatePrecision } from '@/lib/db/types';
import { addEventPhotos, saveEvent, type EventInput } from '@/lib/actions';
import { uploadEventPhoto } from '@/lib/images';
import { flushSync } from '@/lib/sync/scheduler';
import { useSyncStatus } from '@/lib/sync/status';
import { todayIso } from '@/domain/dates';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { DateField, Field, FormSection, Toggle } from '@/components/ui/Form';
import { PersonPicker, ProfileToggles } from '@/components/PersonPicker';
import { CatIcon } from '@/components/icons';
import { EmptyState } from '@/components/ui/States';
import { useAuth } from '@/features/auth/AuthProvider';

const blankToNull = (v: string) => (v.trim() ? v.trim() : null);

function LocalPreview({ file, onRemove }: { file: File; onRemove: () => void }) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  return (
    <span className="relative block h-20 w-20 overflow-hidden rounded-xl bg-surface-2">
      <img src={url} alt="" className="h-full w-full object-cover" onLoad={() => URL.revokeObjectURL(url)} />
      <button type="button" aria-label="Foto verwijderen" onClick={onRemove} className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white">
        <X size={13} />
      </button>
    </span>
  );
}

export default function EventFormPage() {
  const { id: editId } = useParams();
  const [params] = useSearchParams();
  const s = useStore();
  const navigate = useNavigate();
  const { online } = useSyncStatus();
  const { user } = useAuth();
  const existing = editId ? s.eventById.get(editId) : undefined;
  const id = useMemo(() => existing?.id ?? newId(), [existing?.id]);
  const prefillPerson = params.get('persoon');

  const [f, setF] = useState(() => ({
    title: existing?.title ?? '',
    description: existing?.description ?? '',
    personal_note: existing?.personal_note ?? '',
    event_date: existing?.event_date ?? todayIso(),
    date_precision: existing?.date_precision ?? ('day' as DatePrecision),
    event_end_date: existing?.event_end_date ?? '',
    event_category_id: existing?.event_category_id ?? s.event_categories.find((c) => c.system_key === 'memory')?.id ?? s.event_categories[0]?.id ?? '',
    theme: existing?.theme ?? '',
    location: existing?.location ?? '',
    is_highlight: existing?.is_highlight ?? false,
    is_private: existing?.is_private ?? false,
  }));
  const [personIds, setPersonIds] = useState<string[]>(() =>
    existing ? s.event_persons.filter((l) => l.event_id === existing.id).map((l) => l.person_id) : prefillPerson && s.personById.has(prefillPerson) ? [prefillPerson] : [],
  );
  const [profileIds, setProfileIds] = useState<string[]>(() => {
    if (existing) return s.event_profiles.filter((l) => l.event_id === existing.id).map((l) => l.profile_id);
    if (prefillPerson) {
      const linked = s.person_connections.filter((c) => c.person_id === prefillPerson).map((c) => c.profile_id);
      if (linked.length) return linked;
    }
    return s.profiles.map((p) => p.id);
  });
  const [files, setFiles] = useState<File[]>([]);
  const [multiDay, setMultiDay] = useState(!!existing?.event_end_date);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  if (editId && !existing) return <EmptyState title="Gebeurtenis niet gevonden" text="Misschien werd ze verwijderd, of is ze privé van de ander." />;

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const types = s.event_categories.filter((c) => !c.archived_at || c.id === existing?.event_category_id);

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    const e: Record<string, string> = {};
    if (!f.title.trim()) e.title = 'Geef de gebeurtenis een titel.';
    if (!f.event_date) e.event_date = 'Kies een datum (of enkel een jaar).';
    if (multiDay && f.event_end_date && f.event_end_date < f.event_date) e.event_end_date = 'De einddatum ligt vóór de begindatum.';
    if (!f.event_category_id) e.event_category_id = 'Kies een type.';
    setErrors(e);
    if (Object.keys(e).length) return window.scrollTo({ top: 0, behavior: 'smooth' });

    setBusy('Opslaan…');
    const data: EventInput = {
      title: f.title.trim(),
      description: blankToNull(f.description),
      personal_note: blankToNull(f.personal_note),
      event_date: f.event_date,
      date_precision: f.date_precision,
      event_end_date: multiDay && f.event_end_date && f.event_end_date !== f.event_date ? f.event_end_date : null,
      event_category_id: f.event_category_id,
      theme: blankToNull(f.theme),
      location: blankToNull(f.location),
      is_highlight: f.is_highlight,
      is_private: f.is_private,
    };
    await saveEvent(s, data, { personIds, profileIds }, id);

    if (files.length) {
      // Foto's gaan naar Supabase Storage; dat vraagt verbinding. De gebeurtenis zelf is al veilig bewaard.
      try {
        setBusy(`Foto's uploaden (0/${files.length})…`);
        await flushSync().catch(() => {});
        const start = s.event_photos.filter((p) => p.event_id === id).length;
        const done = [];
        for (const [i, file] of files.entries()) {
          const up = await uploadEventPhoto(id, file);
          done.push({ ...up, display_order: start + i, personIds });
          setBusy(`Foto's uploaden (${i + 1}/${files.length})…`);
        }
        await addEventPhotos(id, done);
      } catch (err) {
        setBusy(null);
        setUploadError(
          `De gebeurtenis is opgeslagen, maar de foto's konden niet geüpload worden${navigator.onLine ? ` (${err instanceof Error ? err.message : String(err)})` : ' (offline)'}. Voeg ze later toe vanuit de gebeurtenis.`,
        );
        return;
      }
    }
    navigate(`/story/${id}`, { replace: true });
  };

  if (uploadError)
    return (
      <div className="mx-auto max-w-xl px-4 pt-10">
        <div className="card space-y-3 p-5">
          <p className="font-semibold">Gedeeltelijk gelukt</p>
          <p className="text-sm text-muted">{uploadError}</p>
          <Button variant="primary" block onClick={() => navigate(`/story/${id}`, { replace: true })}>
            Naar de gebeurtenis
          </Button>
        </div>
      </div>
    );

  return (
    <form onSubmit={submit} className="mx-auto max-w-2xl px-4 pb-8 md:px-0" noValidate>
      <PageHeader back title={existing ? 'Moment bewerken' : 'Nieuw moment'} subtitle="Voor Our Story — ook herinneringen van jaren geleden" />
      <div className="mt-2 space-y-6">
        <FormSection title="Wat gebeurde er?">
          <Field label="Titel" required error={errors.title}>
            {(fid) => <input id={fid} className="field" value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="Bv. Eerste ontmoeting met Thomas" maxLength={160} autoFocus={!existing} />}
          </Field>
          <Field label="Type" required error={errors.event_category_id}>
            {() => (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {types.map((c) => {
                  const on = f.event_category_id === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => set('event_category_id', c.id)}
                      className={`flex min-h-[46px] items-center gap-2 rounded-xl border px-3 text-left text-sm transition ${on ? '' : 'border-border text-muted hover:text-text'}`}
                      style={on ? { borderColor: c.color, background: `${c.color}1a`, color: 'var(--text)' } : undefined}
                    >
                      <span style={{ color: c.color }}>
                        <CatIcon name={c.icon} size={16} />
                      </span>
                      <span className="flex-1 leading-tight">{c.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </Field>
          <Field label="Wanneer?" required error={errors.event_date} hint="Weet je de precieze dag niet meer? Kies maand of jaar.">
            {(fid) => <DateField id={fid} value={f.event_date} precision={f.date_precision} onChange={(d, p) => setF((x) => ({ ...x, event_date: d, date_precision: p }))} />}
          </Field>
          <Toggle checked={multiDay} onChange={setMultiDay} label="Meerdere dagen" hint="Bv. een vakantie of weekend" />
          {multiDay && (
            <Field label="Einddatum" error={errors.event_end_date}>
              {(fid) => <input id={fid} className="field" type="date" min={f.event_date} value={f.event_end_date} onChange={(e) => set('event_end_date', e.target.value)} />}
            </Field>
          )}
          <Field label="Beschrijving">
            {(fid) => <textarea id={fid} className="field min-h-[90px]" value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="Wat maakte dit moment bijzonder?" maxLength={5000} />}
          </Field>
        </FormSection>

        <FormSection title="Wie waren erbij?">
          <Field label="Betrokken profiel">{() => <ProfileToggles value={profileIds} onChange={setProfileIds} />}</Field>
          <Field label="Betrokken personen" hint="Dit moment verschijnt ook in hun persoonlijke geschiedenis.">
            {() => <PersonPicker value={personIds} onChange={setPersonIds} />}
          </Field>
        </FormSection>

        <FormSection title="Foto's">
          {existing ? (
            <p className="text-sm text-muted">Foto's toevoegen, beschrijven of verwijderen doe je op de pagina van de gebeurtenis.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {files.map((file, i) => (
                  <LocalPreview key={`${file.name}-${i}`} file={file} onRemove={() => setFiles(files.filter((_, j) => j !== i))} />
                ))}
                <button type="button" onClick={() => input.current?.click()} className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border text-xs text-muted hover:text-text">
                  <ImagePlus size={20} /> Kiezen
                </button>
              </div>
              <input
                ref={input}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  setFiles([...files, ...Array.from(e.target.files ?? [])].slice(0, 30));
                  e.target.value = '';
                }}
              />
              {files.length > 0 && !online && <p className="text-xs text-warn">Je bent offline. Het moment wordt bewaard, maar foto's uploaden lukt pas met verbinding.</p>}
            </>
          )}
        </FormSection>

        <FormSection title="Extra">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Locatie">{(fid) => <input id={fid} className="field" value={f.location} onChange={(e) => set('location', e.target.value)} placeholder="Bv. Gent" maxLength={200} />}</Field>
            <Field label="Thema">{(fid) => <input id={fid} className="field" value={f.theme} onChange={(e) => set('theme', e.target.value)} placeholder="Bv. Vakantie, Kerst" maxLength={80} />}</Field>
          </div>
          <Field label="Persoonlijke notitie">
            {(fid) => <textarea id={fid} className="field min-h-[72px]" value={f.personal_note} onChange={(e) => set('personal_note', e.target.value)} placeholder="Iets voor onszelf" maxLength={5000} />}
          </Field>
          <Toggle
            checked={f.is_highlight}
            onChange={(v) => set('is_highlight', v)}
            label={
              <span className="flex items-center gap-2">
                <Star size={15} className="text-gold" /> Belangrijk moment
              </span>
            }
            hint="Komt in het jaaroverzicht bij de hoogtepunten."
          />
          {/* Enkel de maker kan iets privé maken (de server weigert het anders). */}
          {(!existing?.created_by || existing.created_by === user?.id) && (
            <Toggle
              checked={f.is_private}
              onChange={(v) => set('is_private', v)}
              label={
                <span className="flex items-center gap-2">
                  <Lock size={15} /> Privé
                </span>
              }
              hint="Enkel zichtbaar voor wie het moment aanmaakte."
            />
          )}
        </FormSection>

        <div className="sticky bottom-[calc(var(--nav-h)+var(--safe-bottom)+8px)] z-10 flex gap-2 md:bottom-4">
          <Button block size="lg" onClick={() => navigate(-1)} disabled={!!busy}>
            Annuleren
          </Button>
          <Button block size="lg" variant="primary" type="submit" loading={!!busy}>
            {busy ?? 'Opslaan'}
          </Button>
        </div>
      </div>
    </form>
  );
}
