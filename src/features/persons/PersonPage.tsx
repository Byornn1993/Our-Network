import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Archive,
  CalendarPlus,
  Cake,
  ChevronLeft,
  Heart,
  Info,
  Link2,
  Mail,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Network,
  NotebookPen,
  Pencil,
  Phone,
  RotateCcw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useStore } from '@/lib/db/store';
import type { Relationship, RelationshipHistory } from '@/lib/db/types';
import { archivePerson, deletePerson, restorePerson, setPersonAvatar, updateHistoryEntry } from '@/lib/actions';
import { removeFiles, uploadAvatar } from '@/lib/images';
import { ageOn, daysUntilBirthday, durationSince, formatDate, todayIso } from '@/domain/dates';
import { fullName, RELATIONSHIP_LABEL, ringOf } from '@/domain/people';
import { personTimeline } from '@/domain/timeline';
import { Avatar } from '@/components/Avatar';
import { AvatarPicker } from '@/components/AvatarEditor';
import { Badge, DateField, Field } from '@/components/ui/Form';
import { Button, IconButton } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/States';
import { TimelineList, PhotoThumb } from '@/features/story/TimelineList';
import { RelationshipSheet } from './RelationshipSheet';

function InfoRow({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 py-2.5">
      <span className="mt-0.5 text-muted">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted">{label}</p>
        <div className="whitespace-pre-line break-words text-[15px]">{children}</div>
      </div>
    </div>
  );
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="card p-4">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function HistoryEditSheet({ entry, onClose }: { entry: RelationshipHistory; onClose: () => void }) {
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

export default function PersonPage() {
  const { id } = useParams();
  const s = useStore();
  const navigate = useNavigate();
  const { confirm, dialog } = useConfirm();
  const [menu, setMenu] = useState(false);
  const [relSheet, setRelSheet] = useState<{ edit?: Relationship } | null>(null);
  const [histEdit, setHistEdit] = useState<RelationshipHistory | null>(null);
  const person = id ? s.personById.get(id) : undefined;
  const timeline = useMemo(() => (person ? personTimeline(s, person.id) : []), [s, person]);

  if (!person || person.deleted_at)
    return (
      <EmptyState
        title="Persoon niet gevonden"
        text="Deze persoon werd verwijderd. Gebeurtenissen waarin hij of zij voorkwam, blijven bewaard in Our Story."
        action={<Button onClick={() => navigate('/personen')}>Naar personen</Button>}
      />
    );

  const c = s.categoryById.get(person.category_id);
  const name = fullName(person);
  const conns = s.person_connections.filter((x) => x.person_id === person.id);
  const rels = s.relationships.filter((r) => r.person_id === person.id || r.related_person_id === person.id);
  const history = s.relationship_history.filter((h) => h.person_id === person.id && h.change_type === 'category').sort((a, b) => a.effective_date.localeCompare(b.effective_date));
  const photoIds = new Set(s.photo_persons.filter((pp) => pp.person_id === person.id).map((pp) => pp.photo_id));
  const photos = s.event_photos.filter((p) => photoIds.has(p.id) && s.eventById.has(p.event_id));
  const since = person.first_met_at ?? person.added_at;
  const phoneHref = person.phone?.replace(/[^\d+]/g, '');

  const doArchive = async () => {
    setMenu(false);
    const ok = await confirm({
      title: `${person.first_name} archiveren?`,
      message: 'Archiveren haalt deze persoon van de kaart, maar bewaart alles: profiel, geschiedenis en herinneringen. Je kunt dit altijd terugdraaien.',
      confirmLabel: 'Archiveren',
    });
    if (ok) await archivePerson(person, { date: todayIso(), precision: 'day' }, null);
  };

  const doDelete = async () => {
    setMenu(false);
    const n = s.event_persons.filter((l) => l.person_id === person.id).length;
    const ok = await confirm({
      title: `${name} verwijderen?`,
      message: (
        <>
          <p>Deze persoon verdwijnt uit het netwerk en de lijst.</p>
          <p className="mt-2">
            {n > 0 ? `De ${n} gekoppelde ${n === 1 ? 'herinnering blijft' : 'herinneringen blijven'} bewaard in Our Story.` : 'Er zijn geen gekoppelde herinneringen.'} Twijfel je? Kies dan liever “Archiveren”.
          </p>
        </>
      ),
      confirmLabel: 'Verwijderen',
      danger: true,
    });
    if (!ok) return;
    await deletePerson(s, person);
    navigate('/personen', { replace: true });
  };

  return (
    <div className="mx-auto max-w-3xl px-4 pb-8 md:px-0">
      <div className="flex items-center justify-between pt-3">
        <IconButton label="Terug" className="-ml-3" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/personen'))}>
          <ChevronLeft size={24} />
        </IconButton>
        <div className="flex">
          <IconButton label="Bewerken" onClick={() => navigate(`/personen/${person.id}/bewerken`)}>
            <Pencil size={19} />
          </IconButton>
          <IconButton label="Meer acties" onClick={() => setMenu(true)}>
            <MoreHorizontal size={22} />
          </IconButton>
        </div>
      </div>

      {/* kop */}
      <div className="flex flex-col items-center text-center">
        <AvatarPicker
          path={person.avatar_path}
          name={name}
          color={c?.color}
          size={112}
          onUpload={async (blob) => {
            const old = person.avatar_path;
            const path = await uploadAvatar('persons', person.id, blob);
            await setPersonAvatar(person.id, path);
            void removeFiles([old]);
          }}
        />
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{name}</h1>
        <div className="mt-2 flex flex-wrap justify-center gap-1.5">
          {c && (
            <Badge color={c.color} icon={c.icon}>
              {c.name}
            </Badge>
          )}
          {c && <Badge color="var(--c4)">{ringOf(person, c)}e ring</Badge>}
          {person.archived_at && <Badge color="var(--warn)">Gearchiveerd</Badge>}
        </div>
        {person.description && <p className="mt-3 max-w-md text-sm text-muted">{person.description}</p>}

        <div className="mt-4 flex gap-3">
          {[
            { href: phoneHref ? `tel:${phoneHref}` : null, label: 'Bellen', icon: Phone },
            { href: phoneHref ? `sms:${phoneHref}` : null, label: 'Bericht', icon: MessageCircle },
            { href: person.email ? `mailto:${person.email}` : null, label: 'Mailen', icon: Mail },
          ].map((a) =>
            a.href ? (
              <a key={a.label} href={a.href} className="flex flex-col items-center gap-1 text-xs text-muted">
                <span className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card text-text hover:border-accent/50">
                  <a.icon size={19} />
                </span>
                {a.label}
              </a>
            ) : null,
          )}
          <Link to={`/story/nieuw?persoon=${person.id}`} className="flex flex-col items-center gap-1 text-xs text-muted">
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-accent/40 bg-primary-soft text-accent">
              <CalendarPlus size={19} />
            </span>
            Moment
          </Link>
          <Link to="/netwerk" className="flex flex-col items-center gap-1 text-xs text-muted">
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card text-text hover:border-accent/50">
              <Network size={19} />
            </span>
            Netwerk
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="space-y-4">
          {(person.phone || person.email || person.other_contacts.length > 0) && (
            <Section title="Contactinformatie">
              <div className="divide-y divide-border">
                {person.phone && (
                  <InfoRow icon={<Phone size={16} />} label="Telefoon">
                    <a href={`tel:${phoneHref}`} className="hover:text-accent">
                      {person.phone}
                    </a>
                  </InfoRow>
                )}
                {person.email && (
                  <InfoRow icon={<Mail size={16} />} label="E-mail">
                    <a href={`mailto:${person.email}`} className="hover:text-accent">
                      {person.email}
                    </a>
                  </InfoRow>
                )}
                {person.other_contacts.map((o, i) => (
                  <InfoRow key={i} icon={<MapPin size={16} />} label={o.label}>
                    {o.value}
                  </InfoRow>
                ))}
              </div>
            </Section>
          )}

          <Section title="Persoonlijke informatie">
            <div className="divide-y divide-border">
              {person.birth_date && (
                <InfoRow icon={<Cake size={16} />} label="Geboortedatum">
                  {formatDate(person.birth_date)} · {ageOn(person.birth_date)} jaar
                  {(() => {
                    const d = daysUntilBirthday(person.birth_date);
                    return d === 0 ? <span className="ml-2 text-accent">Vandaag jarig!</span> : d <= 30 ? <span className="ml-2 text-xs text-accent">over {d} dagen jarig</span> : null;
                  })()}
                </InfoRow>
              )}
              {person.met_via && (
                <InfoRow icon={<Sparkles size={16} />} label="Waar kennen we elkaar van">
                  {person.met_via}
                </InfoRow>
              )}
              {person.hobbies && (
                <InfoRow icon={<Heart size={16} />} label="Hobby's">
                  {person.hobbies}
                </InfoRow>
              )}
              {person.interests && (
                <InfoRow icon={<Sparkles size={16} />} label="Interesses">
                  {person.interests}
                </InfoRow>
              )}
              {person.important_info && (
                <InfoRow icon={<Info size={16} />} label="Belangrijk om te onthouden">
                  {person.important_info}
                </InfoRow>
              )}
              {person.notes && (
                <InfoRow icon={<NotebookPen size={16} />} label="Notities">
                  {person.notes}
                </InfoRow>
              )}
              {!person.birth_date && !person.met_via && !person.hobbies && !person.interests && !person.important_info && !person.notes && (
                <p className="py-2 text-sm text-muted">
                  Nog niets ingevuld.{' '}
                  <Link to={`/personen/${person.id}/bewerken`} className="text-accent hover:underline">
                    Aanvullen
                  </Link>
                </p>
              )}
            </div>
          </Section>

          <Section title="Relatie & geschiedenis">
            <div className="space-y-3 pt-1">
              {s.profiles.map((p) => {
                const conn = conns.find((x) => x.profile_id === p.id);
                return (
                  <div key={p.id} className={`flex items-center gap-3 ${conn ? '' : 'opacity-45'}`}>
                    <Avatar path={p.avatar_path} name={p.name} size={34} color={conn ? 'var(--accent)' : undefined} />
                    <div className="text-sm">
                      <p>{conn ? `Verbonden met ${p.name}` : `Niet verbonden met ${p.name}`}</p>
                      {conn?.description && <p className="text-xs text-muted">{conn.description}</p>}
                    </div>
                  </div>
                );
              })}
              <p className="text-sm text-muted">
                In ons leven sinds {formatDate(since, person.first_met_at ? person.first_met_precision : 'day')} ({durationSince(since)}). In de app sinds {formatDate(person.created_at.slice(0, 10))}.
              </p>
            </div>
            {history.length > 0 && (
              <div className="mt-4">
                <p className="label mb-2">Relatieontwikkeling</p>
                <ol className="flex flex-wrap items-center gap-1.5">
                  {history.map((h, i) => {
                    const hc = s.categoryById.get(h.category_id!);
                    return (
                      <li key={h.id} className="flex items-center gap-1.5">
                        {i > 0 && <span className="text-faint">→</span>}
                        <button type="button" onClick={() => setHistEdit(h)} className="rounded-xl border border-border px-2.5 py-1 text-left hover:border-accent/50" title="Datum aanpassen">
                          <span className="block text-[11px] text-muted">{formatDate(h.effective_date, h.date_precision, 'short')}</span>
                          <span className="block text-sm font-medium" style={{ color: hc?.color }}>
                            {hc?.name}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}
          </Section>

          <Section
            title="Onderlinge relaties"
            action={
              <Button size="sm" variant="ghost" icon={<Link2 size={14} />} onClick={() => setRelSheet({})}>
                Toevoegen
              </Button>
            }
          >
            {rels.length === 0 ? (
              <p className="py-1 text-sm text-muted">Nog geen relaties met andere personen.</p>
            ) : (
              <ul className="divide-y divide-border">
                {rels.map((r) => {
                  const other = s.personById.get(r.person_id === person.id ? r.related_person_id : r.person_id);
                  if (!other || other.deleted_at) return null;
                  return (
                    <li key={r.id} className="flex items-center gap-3 py-2">
                      <Link to={`/personen/${other.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                        <Avatar path={other.avatar_path} name={fullName(other)} size={36} color={s.categoryById.get(other.category_id)?.color} />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{fullName(other)}</span>
                          <span className="block truncate text-xs text-muted">{[RELATIONSHIP_LABEL[r.relationship_type], r.description].filter(Boolean).join(' · ')}</span>
                        </span>
                      </Link>
                      <IconButton label="Relatie bewerken" onClick={() => setRelSheet({ edit: r })}>
                        <Pencil size={15} />
                      </IconButton>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>
        </div>

        <div className="space-y-4">
          {photos.length > 0 && (
            <Section title={`Foto's met ${person.first_name}`}>
              <div className="mt-2 grid grid-cols-4 gap-1.5">
                {photos.slice(0, 8).map((p) => (
                  <Link key={p.id} to={`/story/${p.event_id}`} aria-label="Bekijk herinnering">
                    <PhotoThumb photo={p} size={72} />
                  </Link>
                ))}
              </div>
            </Section>
          )}
          <Section
            title="Persoonlijke geschiedenis"
            action={
              <Link to={`/story/nieuw?persoon=${person.id}`} className="flex items-center gap-1 text-sm text-accent hover:underline">
                <CalendarPlus size={14} /> Moment
              </Link>
            }
          >
            <div className="mt-3">
              <TimelineList items={timeline} showPerson={false} />
            </div>
          </Section>
        </div>
      </div>

      <Sheet open={menu} onClose={() => setMenu(false)} title={name}>
        <div className="space-y-1 p-2">
          <button type="button" className="flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 hover:bg-surface" onClick={() => navigate(`/personen/${person.id}/bewerken`)}>
            <Pencil size={18} /> Bewerken
          </button>
          {person.archived_at ? (
            <button type="button" className="flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 hover:bg-surface" onClick={() => void restorePerson(person).then(() => setMenu(false))}>
              <RotateCcw size={18} /> Terug actief maken
            </button>
          ) : (
            <button type="button" className="flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 hover:bg-surface" onClick={() => void doArchive()}>
              <Archive size={18} /> Archiveren
            </button>
          )}
          <button type="button" className="flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 text-danger hover:bg-danger/10" onClick={() => void doDelete()}>
            <Trash2 size={18} /> Verwijderen
          </button>
        </div>
      </Sheet>
      <RelationshipSheet open={!!relSheet} onClose={() => setRelSheet(null)} personId={person.id} edit={relSheet?.edit} />
      {histEdit && <HistoryEditSheet entry={histEdit} onClose={() => setHistEdit(null)} />}
      {dialog}
    </div>
  );
}
