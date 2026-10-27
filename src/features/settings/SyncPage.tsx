import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { SyncIndicator } from '@/components/layout/SyncIndicator';
import { useConflicts, useOutbox } from '@/lib/db/store';
import { deleteLocalDb, getDb } from '@/lib/db/schema';
import type { SyncTable } from '@/lib/db/types';
import { resolveConflict } from '@/lib/sync/engine';
import { flushSync } from '@/lib/sync/scheduler';
import { useSyncStatus } from '@/lib/sync/status';
import { useAuth } from '@/features/auth/AuthProvider';

const TABLE_LABELS: Record<SyncTable, string> = {
  profiles: 'Profiel',
  categories: 'Categorie',
  event_categories: 'Gebeurtenistype',
  persons: 'Persoon',
  person_connections: 'Verbinding met profiel',
  relationships: 'Relatie',
  network_positions: 'Positie op de kaart',
  contact_history: 'Contactmoment',
  relationship_history: 'Relatiegeschiedenis',
  events: 'Gebeurtenis',
  event_persons: 'Persoon bij gebeurtenis',
  event_profiles: 'Profiel bij gebeurtenis',
  event_photos: 'Foto',
  photo_persons: 'Persoon op foto',
};

const when = (iso: string) => format(new Date(iso), 'd/MM/yyyy HH:mm');

function describe(x: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const k of ['first_name', 'last_name', 'title', 'name', 'event_date', 'description']) if (typeof x[k] === 'string' && x[k]) parts.push(String(x[k]));
  if (x.deleted_at) parts.push('(verwijderd)');
  if (x.archived_at) parts.push('(gearchiveerd)');
  return parts.join(' · ').slice(0, 140) || '—';
}

export default function SyncPage() {
  const outbox = useOutbox();
  const conflicts = useConflicts();
  const status = useSyncStatus();
  const { user } = useAuth();
  const { confirm, dialog } = useConfirm();
  const [syncing, setSyncing] = useState(false);

  // Lokale kopie wissen en opnieuw ophalen. Ook bruikbaar als IndexedDB op dit toestel
  // in een foutieve toestand zit (bv. "Unable to open cursor" op iOS). Je blijft ingelogd.
  const rebuild = async () => {
    let pending = 0;
    try {
      pending = await getDb().outbox.count();
    } catch {
      pending = -1;
    }
    const ok = await confirm({
      title: 'Lokale kopie opnieuw opbouwen?',
      message:
        pending > 0
          ? `Let op: ${pending} wijziging(en) op dit toestel zijn nog niet verstuurd en gaan verloren. Alles wat al op de server staat, wordt opnieuw opgehaald.`
          : 'De gegevens op dit toestel worden gewist en opnieuw van de server opgehaald. Je blijft ingelogd.',
      confirmLabel: 'Opnieuw opbouwen',
      danger: pending > 0,
    });
    if (!ok || !user) return;
    await deleteLocalDb(user.id).catch(() => {});
    window.location.reload();
  };

  return (
    <div className="mx-auto max-w-2xl px-4 pb-10 md:px-0">
      <PageHeader title="Synchronisatie" back="/instellingen" />
      <div className="mt-2 space-y-4">
        <Card className="flex items-center justify-between gap-3 p-4">
          <div>
            <SyncIndicator />
            {status.lastSyncedAt && <p className="px-2 text-xs text-faint">Laatst: {when(status.lastSyncedAt)}</p>}
            {status.error && <p className="px-2 text-xs text-danger">{status.error}</p>}
          </div>
          <Button
            icon={<RefreshCw size={16} />}
            loading={syncing}
            onClick={async () => {
              setSyncing(true);
              await flushSync().catch(() => {});
              setSyncing(false);
            }}
          >
            Nu synchroniseren
          </Button>
        </Card>

        {conflicts && conflicts.length > 0 && (
          <section className="space-y-2">
            <p className="label">Conflicten</p>
            <p className="text-sm text-muted">Dit werd op een ander toestel (of door de ander) gewijzigd terwijl je het hier ook aanpaste. Kies welke versie blijft.</p>
            {conflicts.map((c) => (
              <Card key={c.key} className="space-y-3 p-4">
                <p className="font-semibold">{TABLE_LABELS[c.table]}</p>
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <div className="rounded-lg bg-surface-2 p-3">
                    <p className="label">Deze versie (dit toestel)</p>
                    <p className="mt-1">{describe(c.local)}</p>
                  </div>
                  <div className="rounded-lg bg-surface-2 p-3">
                    <p className="label">Serverversie ({when(c.remoteUpdatedAt)})</p>
                    <p className="mt-1">{describe(c.remote)}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button block onClick={() => resolveConflict(getDb(), c.key, 'server').then(() => flushSync())}>
                    Serverversie
                  </Button>
                  <Button variant="primary" block onClick={() => resolveConflict(getDb(), c.key, 'mine').then(() => flushSync())}>
                    Mijn versie
                  </Button>
                </div>
              </Card>
            ))}
          </section>
        )}

        <section className="space-y-2">
          <p className="label">Wachtrij ({outbox?.length ?? 0})</p>
          {!outbox || outbox.length === 0 ? (
            <p className="text-sm text-muted">Alles is verstuurd.</p>
          ) : (
            <Card className="divide-y divide-border">
              {outbox.map((op) => (
                <div key={op.seq} className="flex items-center gap-3 p-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate">
                      {TABLE_LABELS[op.table]} · {describe(op.row)}
                    </p>
                    <p className="text-xs text-faint">
                      {when(op.createdAt)}
                      {op.attempts > 0 && ` · ${op.attempts} poging(en)`}
                    </p>
                    {op.lastError && <p className="text-xs text-danger">{op.lastError}</p>}
                  </div>
                  {op.lastError && (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={async () => {
                        if (
                          await confirm({
                            title: 'Wijziging laten vallen?',
                            message: 'Deze wijziging wordt niet naar de server gestuurd. Daarna wordt alles opnieuw van de server opgehaald.',
                            confirmLabel: 'Laten vallen',
                            danger: true,
                          })
                        ) {
                          const db = getDb();
                          await db.outbox.delete(op.seq!);
                          await db.meta.bulkDelete((await db.meta.toArray()).filter((m) => m.key.startsWith('cursor:')).map((m) => m.key));
                          void flushSync().catch(() => {});
                        }
                      }}
                    >
                      Laten vallen
                    </Button>
                  )}
                </div>
              ))}
            </Card>
          )}
        </section>

        <Card className="space-y-2 p-4">
          <p className="font-semibold">Problemen op dit toestel?</p>
          <p className="text-sm text-muted">Ontbreekt er data of zie je een foutmelding? Bouw de lokale kopie opnieuw op vanaf de server.</p>
          <Button block onClick={() => void rebuild()}>
            Lokale kopie opnieuw opbouwen
          </Button>
        </Card>
      </div>
      {dialog}
    </div>
  );
}
