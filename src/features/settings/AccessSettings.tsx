import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { MailPlus, ShieldCheck, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button, IconButton } from '@/components/ui/Button';
import { ErrorState, Spinner } from '@/components/ui/States';
import { useAuth } from '@/features/auth/AuthProvider';
import type { Member } from '@/lib/backend/types';
import { formatDate } from '@/domain/dates';
import { isArtifactMode } from '@/lib/backend';

/** Wie mag in de gedeelde netwerkruimte. Vraagt verbinding (wordt niet lokaal bewaard). */
/** In de artifact-versie bepaalt het deelmenu van Claude wie toegang heeft. */
function ArtifactAccess() {
  const { backend } = useAuth();
  const p = backend?.permissions;
  return (
    <div className="mx-auto max-w-2xl px-4 pb-10 md:px-0">
      <PageHeader back="/instellingen" title="Toegang" subtitle="Wie jullie netwerk ziet" />
      <div className="card mt-2 space-y-3 p-4 text-sm">
        <p className="flex items-center gap-2 font-semibold">
          <ShieldCheck size={18} className="text-accent" /> Toegang via het deelmenu van Claude
        </p>
        <p className="text-muted">
          Enkel de eigenaar van deze artifact en wie als <b className="text-text">Editor</b> is uitgenodigd, kan het netwerk lezen en aanpassen en foto’s toevoegen. Viewers,
          Commenters en Contributors zien niets.
        </p>
        <ol className="list-decimal space-y-1 pl-5 text-muted">
          <li>Open de artifact op claude.ai en kies <b className="text-text">Delen</b>.</li>
          <li>Nodig Stephanie uit met haar e-mailadres, als <b className="text-text">Editor</b>.</li>
          <li>Deel de artifact niet via een openbare link: dan kan een uitgenodigde Editor niet meer schrijven.</li>
        </ol>
        <p className="text-muted">Privé-momenten blijven altijd enkel zichtbaar voor wie ze maakte, ook voor de eigenaar.</p>
        <p className="text-xs text-faint">
          Jij op dit toestel: {p?.canWrite === false ? 'alleen lezen' : 'mag lezen en aanpassen'}
          {p && !p.canUpload ? ' · foto’s uploaden niet mogelijk' : ''}.
        </p>
      </div>
    </div>
  );
}

export default function AccessSettings() {
  return isArtifactMode ? <ArtifactAccess /> : <MemberAccess />;
}

function MemberAccess() {
  const { backend, user } = useAuth();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [invites, setInvites] = useState<string[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!backend) return;
    setError(null);
    try {
      const [m, i] = await Promise.all([backend.members.list(), backend.members.invites()]);
      setMembers(m);
      setInvites(i);
    } catch (e) {
      setError(navigator.onLine ? e : new Error('Je bent offline. Toegang beheren vraagt een verbinding.'));
    }
  }, [backend]);

  useEffect(() => {
    void load();
  }, [load]);

  const invite = async (e: FormEvent) => {
    e.preventDefault();
    const v = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return setError(new Error('Dit e-mailadres lijkt niet te kloppen.'));
    setBusy(true);
    try {
      await backend!.members.invite(v);
      setEmail('');
      await load();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const memberEmails = new Set(members?.map((m) => m.email.toLowerCase()));
  const open = invites.filter((i) => !memberEmails.has(i));

  return (
    <div className="mx-auto max-w-2xl px-4 pb-10 md:px-0">
      <PageHeader back="/instellingen" title="Toegang" subtitle="Enkel leden zien jullie netwerk" />
      {error ? <ErrorState error={error} onRetry={() => void load()} /> : null}
      {!members && !error ? (
        <Spinner />
      ) : (
        members && (
          <div className="mt-2 space-y-6">
            <section>
              <h2 className="section-title">Leden</h2>
              <ul className="card divide-y divide-border overflow-hidden">
                {members.map((m) => (
                  <li key={m.user_id} className="flex items-center gap-3 px-4 py-3">
                    <ShieldCheck size={18} className="text-accent" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px]">
                        {m.email} {m.user_id === user?.id && <span className="text-xs text-muted">(jij)</span>}
                      </span>
                      <span className="block text-xs text-muted">Lid sinds {formatDate(m.created_at.slice(0, 10))}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="section-title">Iemand uitnodigen</h2>
              <form onSubmit={invite} className="card space-y-3 p-4">
                <p className="text-sm text-muted">
                  Voeg het e-mailadres toe (bv. van Stephanie). Maak daarna in Supabase › Authentication › Users een account aan met dat adres. Zodra die persoon inlogt, wordt ze automatisch lid.
                </p>
                <div className="flex gap-2">
                  <input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="naam@voorbeeld.be" aria-label="E-mailadres" />
                  <Button type="submit" variant="primary" loading={busy} icon={<MailPlus size={16} />}>
                    Toevoegen
                  </Button>
                </div>
              </form>
              {open.length > 0 && (
                <ul className="card mt-3 divide-y divide-border overflow-hidden">
                  {open.map((i) => (
                    <li key={i} className="flex items-center gap-3 px-4 py-2">
                      <span className="flex-1 truncate text-sm">
                        {i} <span className="text-xs text-muted">· wacht op eerste login</span>
                      </span>
                      <IconButton label="Uitnodiging intrekken" onClick={() => void backend!.members.revokeInvite(i).then(load)}>
                        <Trash2 size={16} />
                      </IconButton>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )
      )}
    </div>
  );
}
