import { useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronDown, Plus, X } from 'lucide-react';
import { useStore } from '@/lib/db/store';
import { newId } from '@/lib/db/repo';
import type { ContactDetail, DatePrecision } from '@/lib/db/types';
import { firstMeetingOf, savePerson, type PersonInput } from '@/lib/actions';
import { removeFiles, uploadAvatar } from '@/lib/images';
import { todayIso } from '@/domain/dates';
import { fullName } from '@/domain/people';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { DateField, Field, FormSection, Segmented, Toggle } from '@/components/ui/Form';
import { AvatarPicker } from '@/components/AvatarEditor';
import { CatIcon } from '@/components/icons';
import { EmptyState } from '@/components/ui/States';

const blankToNull = (v: string) => (v.trim() ? v.trim() : null);

export default function PersonFormPage() {
  const { id: editId } = useParams();
  const s = useStore();
  const navigate = useNavigate();
  const existing = editId ? s.personById.get(editId) : undefined;
  const id = useMemo(() => existing?.id ?? newId(), [existing?.id]);
  const conns = s.person_connections.filter((c) => c.person_id === existing?.id);

  const [f, setF] = useState({
    first_name: existing?.first_name ?? '',
    last_name: existing?.last_name ?? '',
    avatar_path: existing?.avatar_path ?? null,
    birth_date: existing?.birth_date ?? '',
    phone: existing?.phone ?? '',
    email: existing?.email ?? '',
    other_contacts: existing?.other_contacts ?? ([] as ContactDetail[]),
    description: existing?.description ?? '',
    notes: existing?.notes ?? '',
    hobbies: existing?.hobbies ?? '',
    interests: existing?.interests ?? '',
    important_info: existing?.important_info ?? '',
    met_via: existing?.met_via ?? '',
    first_met_at: existing?.first_met_at ?? '',
    first_met_precision: existing?.first_met_precision ?? ('day' as DatePrecision),
    added_at: existing?.added_at ?? todayIso(),
    category_id: existing?.category_id ?? '',
    ring_override: existing?.ring_override ?? null,
  });
  const [connected, setConnected] = useState<Record<string, { on: boolean; description: string }>>(() =>
    Object.fromEntries(
      s.profiles.map((p) => {
        const c = conns.find((x) => x.profile_id === p.id);
        return [p.id, { on: existing ? !!c : true, description: c?.description ?? '' }];
      }),
    ),
  );
  const [change, setChange] = useState({ date: todayIso(), precision: 'day' as DatePrecision, description: '' });
  const [firstMeeting, setFirstMeeting] = useState(true);
  const [more, setMore] = useState(!!existing);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const uploaded = useRef<string[]>([]);

  if (editId && !existing) return <EmptyState title="Persoon niet gevonden" text="Misschien werd deze persoon verwijderd." />;

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const category = s.categoryById.get(f.category_id);
  const categoryChanged = !!existing && existing.category_id !== f.category_id && !!f.category_id;
  const canFirstMeeting = !existing || !firstMeetingOf(s, existing.id);
  const activeCategories = s.categories.filter((c) => !c.archived_at || c.id === existing?.category_id);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!f.first_name.trim()) e.first_name = 'Vul minstens een voornaam in.';
    if (!f.category_id) e.category_id = 'Kies een categorie.';
    if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = 'Dit e-mailadres lijkt niet te kloppen.';
    if (f.phone.trim() && !/^[+\d][\d\s()./-]{3,}$/.test(f.phone.trim())) e.phone = 'Gebruik enkel cijfers, spaties en eventueel + aan het begin.';
    if (f.birth_date && f.birth_date > todayIso()) e.birth_date = 'Een geboortedatum kan niet in de toekomst liggen.';
    if (f.first_met_at && f.first_met_at > todayIso()) e.first_met_at = 'Deze datum ligt in de toekomst.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!validate()) {
      if (errors.first_name || !f.first_name.trim() || !f.category_id) window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setBusy(true);
    const input: PersonInput = {
      first_name: f.first_name.trim(),
      last_name: blankToNull(f.last_name),
      avatar_path: f.avatar_path,
      birth_date: f.birth_date || null,
      phone: blankToNull(f.phone),
      email: blankToNull(f.email)?.toLowerCase() ?? null,
      other_contacts: f.other_contacts.filter((c) => c.value.trim()).map((c) => ({ label: c.label.trim() || 'Andere', value: c.value.trim() })),
      description: blankToNull(f.description),
      notes: blankToNull(f.notes),
      hobbies: blankToNull(f.hobbies),
      interests: blankToNull(f.interests),
      important_info: blankToNull(f.important_info),
      met_via: blankToNull(f.met_via),
      first_met_at: f.first_met_at || null,
      first_met_precision: f.first_met_precision,
      added_at: f.added_at || todayIso(),
      category_id: f.category_id,
      ring_override: f.ring_override,
    };
    await savePerson(s, input, {
      id,
      connections: Object.entries(connected)
        .filter(([, v]) => v.on)
        .map(([profileId, v]) => ({ profileId, description: blankToNull(v.description) })),
      categoryChange: categoryChanged ? { date: change.date || todayIso(), precision: change.precision, description: blankToNull(change.description) } : undefined,
      createFirstMeeting: canFirstMeeting && firstMeeting && !!f.first_met_at,
    });
    // oude, vervangen foto's opruimen
    const stale = [...uploaded.current.filter((p) => p !== f.avatar_path), existing?.avatar_path !== f.avatar_path ? existing?.avatar_path : null];
    void removeFiles(stale);
    navigate(`/personen/${id}`, { replace: true });
  };

  const cancel = () => {
    void removeFiles(uploaded.current);
    navigate(-1);
  };

  return (
    <form onSubmit={submit} className="mx-auto max-w-2xl px-4 pb-8 md:px-0" noValidate>
      <PageHeader back title={existing ? 'Bewerken' : 'Nieuwe persoon'} subtitle={existing ? fullName(existing) : 'Alleen naam en categorie zijn nodig'} />

      <div className="my-4">
        <AvatarPicker
          path={f.avatar_path}
          name={`${f.first_name} ${f.last_name}`}
          color={category?.color}
          onUpload={async (blob) => {
            const path = await uploadAvatar('persons', id, blob);
            uploaded.current.push(path);
            set('avatar_path', path);
          }}
          onRemove={async () => set('avatar_path', null)}
        />
      </div>

      <div className="space-y-6">
        <FormSection title="Basisgegevens">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Voornaam" required error={errors.first_name}>
              {(fid) => <input id={fid} className="field" value={f.first_name} onChange={(e) => set('first_name', e.target.value)} placeholder="Voornaam" autoComplete="off" autoFocus={!existing} maxLength={80} />}
            </Field>
            <Field label="Achternaam">
              {(fid) => <input id={fid} className="field" value={f.last_name} onChange={(e) => set('last_name', e.target.value)} placeholder="Achternaam" autoComplete="off" maxLength={80} />}
            </Field>
          </div>
          <Field label="Categorie" required error={errors.category_id}>
            {() => (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {activeCategories.map((c) => {
                  const on = f.category_id === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => set('category_id', c.id)}
                      className={`flex min-h-[46px] items-center gap-2 rounded-xl border px-3 text-left text-sm transition ${on ? '' : 'border-border text-muted hover:text-text'}`}
                      style={on ? { borderColor: c.color, background: `${c.color}1a`, color: 'var(--text)' } : undefined}
                    >
                      <span style={{ color: c.color }}>
                        <CatIcon name={c.icon} size={16} />
                      </span>
                      <span className="flex-1 truncate">{c.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </Field>
          {categoryChanged && (
            <div className="space-y-3 rounded-xl border border-accent/30 bg-primary-soft p-3">
              <p className="text-sm">
                Van <b>{s.categoryById.get(existing!.category_id)?.name}</b> naar <b>{category?.name}</b>. De vorige categorie blijft bewaard in de relatiegeschiedenis.
              </p>
              <Field label="Vanaf wanneer?">{(fid) => <DateField id={fid} value={change.date} precision={change.precision} onChange={(d, p) => setChange((c) => ({ ...c, date: d, precision: p }))} max={todayIso()} />}</Field>
              <Field label="Wat veranderde er? (optioneel)">
                {(fid) => <input id={fid} className="field" value={change.description} onChange={(e) => setChange((c) => ({ ...c, description: e.target.value }))} placeholder="Bv. samen op reis geweest" maxLength={500} />}
              </Field>
            </div>
          )}
          <Field label="Verbonden met">
            {() => (
              <div className="space-y-2">
                {s.profiles.map((p) => {
                  const v = connected[p.id] ?? { on: false, description: '' };
                  return (
                    <div key={p.id} className="rounded-xl border border-border p-3">
                      <Toggle checked={v.on} onChange={(on) => setConnected((c) => ({ ...c, [p.id]: { ...v, on } }))} label={p.name} />
                      {v.on && (
                        <input
                          className="field mt-2"
                          value={v.description}
                          onChange={(e) => setConnected((c) => ({ ...c, [p.id]: { ...v, description: e.target.value } }))}
                          placeholder={`Relatie tot ${p.name}, bv. broer, collega, vriend`}
                          aria-label={`Relatie tot ${p.name}`}
                          maxLength={120}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Field>
        </FormSection>

        <FormSection title="Ons verhaal">
          <Field label="Waar kennen we deze persoon van?">
            {(fid) => <input id={fid} className="field" value={f.met_via} onChange={(e) => set('met_via', e.target.value)} placeholder="Bv. via het werk, de voetbalclub, via Lisa" maxLength={300} />}
          </Field>
          <Field label="Wanneer leerden we elkaar kennen?" hint="Weet je enkel het jaar of de maand? Kies dan die precisie." error={errors.first_met_at}>
            {(fid) => <DateField id={fid} value={f.first_met_at} precision={f.first_met_precision} onChange={(d, p) => setF((x) => ({ ...x, first_met_at: d, first_met_precision: p }))} max={todayIso()} />}
          </Field>
          {canFirstMeeting && f.first_met_at && (
            <Toggle checked={firstMeeting} onChange={setFirstMeeting} label="Eerste ontmoeting in Our Story zetten" hint="Maakt meteen een gebeurtenis op de tijdlijn en op het profiel." />
          )}
          <Field label="Korte beschrijving">
            {(fid) => <input id={fid} className="field" value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="Eén zin over deze persoon" maxLength={500} />}
          </Field>
        </FormSection>

        <button type="button" onClick={() => setMore(!more)} className="flex w-full items-center justify-center gap-2 text-sm text-muted hover:text-text" aria-expanded={more}>
          <ChevronDown size={16} className={`transition ${more ? 'rotate-180' : ''}`} />
          {more ? 'Minder velden' : 'Meer details: contact, persoonlijke info, afstand'}
        </button>

        {more && (
          <>
            <FormSection title="Contact">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Telefoonnummer" error={errors.phone}>
                  {(fid) => <input id={fid} className="field" type="tel" inputMode="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+32 …" maxLength={40} />}
                </Field>
                <Field label="E-mailadres" error={errors.email}>
                  {(fid) => <input id={fid} className="field" type="email" inputMode="email" value={f.email} onChange={(e) => set('email', e.target.value)} placeholder="naam@voorbeeld.be" maxLength={254} />}
                </Field>
              </div>
              <Field label="Andere contactgegevens">
                {() => (
                  <div className="space-y-2">
                    {f.other_contacts.map((c, i) => (
                      <div key={i} className="flex gap-2">
                        <input
                          className="field w-32"
                          value={c.label}
                          placeholder="Bv. Instagram"
                          aria-label="Soort"
                          onChange={(e) => set('other_contacts', f.other_contacts.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                        />
                        <input
                          className="field flex-1"
                          value={c.value}
                          placeholder="Gegevens"
                          aria-label="Waarde"
                          onChange={(e) => set('other_contacts', f.other_contacts.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
                        />
                        <button type="button" className="tap flex items-center justify-center text-muted" aria-label="Verwijderen" onClick={() => set('other_contacts', f.other_contacts.filter((_, j) => j !== i))}>
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                    <Button size="sm" icon={<Plus size={14} />} onClick={() => set('other_contacts', [...f.other_contacts, { label: '', value: '' }])}>
                      Toevoegen
                    </Button>
                  </div>
                )}
              </Field>
            </FormSection>

            <FormSection title="Persoonlijke informatie">
              <Field label="Geboortedatum" error={errors.birth_date}>
                {(fid) => <input id={fid} className="field" type="date" value={f.birth_date} max={todayIso()} onChange={(e) => set('birth_date', e.target.value)} />}
              </Field>
              <Field label="Hobby's">{(fid) => <input id={fid} className="field" value={f.hobbies} onChange={(e) => set('hobbies', e.target.value)} placeholder="Bv. reisfotografie, yoga" maxLength={1000} />}</Field>
              <Field label="Interesses">{(fid) => <input id={fid} className="field" value={f.interests} onChange={(e) => set('interests', e.target.value)} placeholder="Bv. natuur, lekker eten, muziek" maxLength={1000} />}</Field>
              <Field label="Belangrijk om te onthouden">
                {(fid) => <textarea id={fid} className="field min-h-[72px]" value={f.important_info} onChange={(e) => set('important_info', e.target.value)} placeholder="Allergieën, namen van kinderen, gevoelige onderwerpen…" maxLength={2000} />}
              </Field>
              <Field label="Persoonlijke notities">
                {(fid) => <textarea id={fid} className="field min-h-[96px]" value={f.notes} onChange={(e) => set('notes', e.target.value)} maxLength={10000} />}
              </Field>
            </FormSection>

            <FormSection title="Sociale afstand">
              <p className="text-sm text-muted">
                Standaard bepaalt de categorie de ring ({category ? `${category.name}: ${category.ring}e ring` : 'kies eerst een categorie'}). Je kunt iemand dichter of verder zetten, bv. een allerbeste vriend in de 1e ring.
              </p>
              <Segmented
                value={String(f.ring_override ?? 'auto')}
                onChange={(v) => set('ring_override', v === 'auto' ? null : (Number(v) as 1 | 2 | 3 | 4))}
                options={[
                  { value: 'auto', label: 'Auto' },
                  { value: '1', label: '1' },
                  { value: '2', label: '2' },
                  { value: '3', label: '3' },
                  { value: '4', label: '4' },
                ]}
              />
              <Field label="In ons netwerk sinds" hint="Wanneer werd deze persoon deel van ons netwerk? (Los van wanneer je hem/haar hier invoert.)">
                {(fid) => <input id={fid} className="field" type="date" value={f.added_at} max={todayIso()} onChange={(e) => set('added_at', e.target.value)} />}
              </Field>
            </FormSection>
          </>
        )}

        <div className="sticky bottom-[calc(var(--nav-h)+var(--safe-bottom)+8px)] z-10 flex gap-2 md:bottom-4">
          <Button block size="lg" onClick={cancel}>
            Annuleren
          </Button>
          <Button block size="lg" variant="primary" type="submit" loading={busy}>
            Opslaan
          </Button>
        </div>
      </div>
    </form>
  );
}
