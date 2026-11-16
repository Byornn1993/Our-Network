import { useRef, useState } from 'react';
import { toast } from '@/components/ui/Toast';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CalendarDays, ChevronLeft, ImagePlus, Lock, MapPin, NotebookPen, Pencil, Star, Tag, Trash2 } from 'lucide-react';
import { useStore } from '@/lib/db/store';
import type { EventPhoto } from '@/lib/db/types';
import { addEventPhotos, deleteEvent, deletePhoto, updatePhoto } from '@/lib/actions';
import { removeFiles, uploadEventPhoto, useSignedUrl } from '@/lib/images';
import { useSyncStatus } from '@/lib/sync/status';
import { canUpload } from '@/lib/backend';
import { flushSync } from '@/lib/sync/scheduler';
import { formatRange, relativeDays } from '@/domain/dates';
import { fullName } from '@/domain/people';
import { Avatar } from '@/components/Avatar';
import { Badge, Field } from '@/components/ui/Form';
import { Button, IconButton } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/States';
import { CatIcon } from '@/components/icons';
import { PersonPicker } from '@/components/PersonPicker';
import { PhotoThumb } from './TimelineList';
import { Lightbox } from './Lightbox';

function PhotoEditSheet({ photo, onClose, onDelete }: { photo: EventPhoto; onClose: () => void; onDelete: () => void }) {
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

export default function EventPage() {
  const { id } = useParams();
  const s = useStore();
  const navigate = useNavigate();
  const { online } = useSyncStatus();
  const { confirm, dialog } = useConfirm();
  const [view, setView] = useState<number | null>(null);
  const [editPhoto, setEditPhoto] = useState<EventPhoto | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const e = id ? s.eventById.get(id) : undefined;

  if (!e)
    return <EmptyState title="Gebeurtenis niet gevonden" text="Misschien werd ze verwijderd, of is ze privé." action={<Button onClick={() => navigate('/story')}>Naar Our Story</Button>} />;

  const type = s.eventCategoryById.get(e.event_category_id);
  const color = type?.color ?? 'var(--accent)';
  const persons = s.event_persons.map((l) => (l.event_id === e.id ? s.personById.get(l.person_id) : undefined)).filter((p) => !!p);
  const linkedProfiles = new Set(s.event_profiles.filter((l) => l.event_id === e.id).map((l) => l.profile_id));
  const profiles = s.profiles.filter((p) => linkedProfiles.has(p.id));
  const photos = s.event_photos.filter((p) => p.event_id === e.id).sort((a, b) => a.display_order - b.display_order);
  const captionFor = (p: EventPhoto) => {
    const names = s.photo_persons.filter((pp) => pp.photo_id === p.id).map((pp) => s.personById.get(pp.person_id)?.first_name).filter(Boolean);
    return [p.caption, names.length ? `Met ${names.join(', ')}` : null].filter(Boolean).join(' · ');
  };

  const addPhotos = async (files: File[]) => {
    setError(null);
    try {
      await flushSync().catch(() => {});
      const done = [];
      for (const [i, file] of files.entries()) {
        setUploading(`Uploaden ${i + 1}/${files.length}…`);
        const up = await uploadEventPhoto(e.id, file);
        done.push({ ...up, display_order: photos.length + i, personIds: persons.map((p) => p.id) });
      }
      await addEventPhotos(e.id, done);
    } catch (err) {
      setError(!navigator.onLine ? 'Je bent offline. Foto’s uploaden kan zodra je weer verbinding hebt.' : err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(null);
    }
  };

  const removePhoto = async (p: EventPhoto) => {
    const ok = await confirm({ title: 'Foto verwijderen?', message: 'De foto wordt definitief uit de opslag verwijderd.', confirmLabel: 'Verwijderen', danger: true });
    if (!ok) return;
    setEditPhoto(null);
    setView(null);
    await deletePhoto(p.id);
    void removeFiles([p.storage_path, p.thumb_path]);
    toast('Foto verwijderd ✓');
  };

  const remove = async () => {
    const ok = await confirm({
      title: 'Moment verwijderen?',
      message: `“${e.title}” verdwijnt uit Our Story en uit de geschiedenis van ${persons.length ? persons.map((p) => p.first_name).join(', ') : 'de betrokkenen'}.`,
      confirmLabel: 'Verwijderen',
      danger: true,
    });
    if (!ok) return;
    const undo = await deleteEvent(e.id);
    navigate('/story', { replace: true });
    toast('Moment verwijderd', { label: 'Ongedaan maken', onClick: () => void undo().then(() => toast('Teruggezet ✓')) });
  };

  return (
    <div className="mx-auto max-w-3xl px-4 pb-10 md:px-0">
      <div className="flex items-center justify-between pt-3">
        <IconButton label="Terug" className="-ml-3" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/story'))}>
          <ChevronLeft size={24} />
        </IconButton>
        <div className="flex">
          <IconButton label="Bewerken" onClick={() => navigate(`/story/${e.id}/bewerken`)}>
            <Pencil size={19} />
          </IconButton>
          <IconButton label="Verwijderen" onClick={() => void remove()} className="hover:text-danger">
            <Trash2 size={19} />
          </IconButton>
        </div>
      </div>

      <header className="mt-2">
        <div className="flex flex-wrap items-center gap-2">
          {type && (
            <Badge color={color} icon={type.icon}>
              {type.name}
            </Badge>
          )}
          {e.is_highlight && (
            <Badge color="var(--accent)">
              <Star size={11} className="mr-0.5 inline fill-current" /> Belangrijk
            </Badge>
          )}
          {e.is_private && (
            <Badge color="var(--c4)">
              <Lock size={11} className="mr-0.5 inline" /> Privé
            </Badge>
          )}
        </div>
        <h1 className="mt-3 text-[26px] font-bold leading-tight tracking-tight">{e.title}</h1>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
          <span className="flex items-center gap-1.5">
            <CalendarDays size={15} /> {formatRange(e.event_date, e.event_end_date, e.date_precision)}
          </span>
          {e.location && (
            <span className="flex items-center gap-1.5">
              <MapPin size={15} /> {e.location}
            </span>
          )}
          {e.theme && (
            <span className="flex items-center gap-1.5">
              <Tag size={15} /> {e.theme}
            </span>
          )}
        </div>
      </header>

      {photos.length > 0 && (
        <div className={`mt-5 grid gap-1.5 ${photos.length === 1 ? 'grid-cols-1' : 'grid-cols-3'}`}>
          {photos.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setView(i)}
              className={`overflow-hidden rounded-xl ${photos.length === 1 ? 'aspect-[4/3]' : i === 0 && photos.length >= 3 ? 'col-span-2 row-span-2 aspect-square' : 'aspect-square'}`}
              aria-label={`Foto ${i + 1} bekijken`}
            >
              <PhotoFill photo={p} />
            </button>
          ))}
        </div>
      )}

      <div className={`mt-3 flex items-center gap-3 ${canUpload() ? '' : 'hidden'}`}>
        <Button size="sm" icon={<ImagePlus size={15} />} disabled={!online || !!uploading} loading={!!uploading} onClick={() => input.current?.click()}>
          {uploading ?? "Foto's toevoegen"}
        </Button>
        {!online && <span className="text-xs text-warn">Offline: uploaden kan later</span>}
        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(ev) => {
            const files = Array.from(ev.target.files ?? []);
            ev.target.value = '';
            if (files.length) void addPhotos(files);
          }}
        />
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      {e.description && <p className="mt-5 whitespace-pre-line text-[15px] leading-relaxed">{e.description}</p>}

      {e.personal_note && (
        <div className="card mt-5 flex gap-3 p-4">
          <NotebookPen size={17} className="mt-0.5 shrink-0 text-muted" />
          <p className="whitespace-pre-line text-sm text-muted">{e.personal_note}</p>
        </div>
      )}

      <section className="card mt-5 p-4">
        <h2 className="text-[15px] font-semibold">Wie waren erbij</h2>
        {persons.length === 0 && profiles.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Nog niemand gekoppeld.</p>
        ) : (
          <ul className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-5">
            {profiles.map((p) => (
              <li key={p.id} className="flex flex-col items-center text-center">
                <Avatar path={p.avatar_path} name={p.name} size={52} color={p.slot === 1 ? 'var(--gold)' : 'var(--accent)'} />
                <span className="mt-1 text-xs">{p.name}</span>
              </li>
            ))}
            {persons.map((p) => (
              <li key={p.id}>
                <Link to={p.deleted_at ? '#' : `/personen/${p.id}`} className={`flex flex-col items-center text-center ${p.deleted_at ? 'pointer-events-none opacity-50' : ''}`}>
                  <Avatar path={p.avatar_path} name={fullName(p)} size={52} color={s.categoryById.get(p.category_id)?.color} muted={!!p.archived_at || !!p.deleted_at} />
                  <span className="mt-1 line-clamp-2 text-xs">{fullName(p)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-4 flex items-center gap-1.5 text-xs text-faint">
        <CatIcon name={type?.icon ?? 'sparkles'} size={12} /> Toegevoegd {relativeDays(e.created_at)}
      </p>

      {view !== null && <Lightbox photos={photos} index={view} onIndex={setView} onClose={() => setView(null)} onEdit={(p) => setEditPhoto(p)} captionFor={captionFor} />}
      {editPhoto && <PhotoEditSheet photo={editPhoto} onClose={() => setEditPhoto(null)} onDelete={() => void removePhoto(editPhoto)} />}
      {dialog}
    </div>
  );
}

function PhotoFill({ photo }: { photo: EventPhoto }) {
  const url = useSignedUrl(photo.thumb_path ?? photo.storage_path);
  return <span className="block h-full w-full bg-surface-2">{url && <img src={url} alt={photo.caption ?? ''} className="h-full w-full object-cover" loading="lazy" />}</span>;
}
