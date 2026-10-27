import { useRef, useState } from 'react';
import { Download, FileSpreadsheet, FileUp, Image } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useStore } from '@/lib/db/store';
import { buildBackup, download, importBackup, personsCsv } from '@/lib/backup';
import { todayIso } from '@/domain/dates';

export default function DataSettings() {
  const s = useStore();
  const { confirm, dialog } = useConfirm();
  const input = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const photoCount = s.event_photos.length;
  const avatarCount = s.persons.filter((p) => p.avatar_path).length + s.profiles.filter((p) => p.avatar_path).length;

  const doImport = async (file: File) => {
    const ok = await confirm({
      title: 'Back-up importeren?',
      message: 'De back-up wordt samengevoegd met jullie huidige netwerk. Nieuwere gegevens in de app worden niet overschreven. Dit wordt ook naar de server en het andere toestel gestuurd.',
      confirmLabel: 'Importeren',
    });
    if (!ok) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await importBackup(s, await file.text());
      setMsg({ ok: true, text: `Klaar: ${r.added} toegevoegd, ${r.updated} bijgewerkt, ${r.skipped} ongewijzigd.` });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 pb-10 md:px-0">
      <PageHeader back="/instellingen" title="Gegevens" subtitle="Exporteren, importeren en back-up" />
      <div className="mt-2 space-y-4">
        <section className="card space-y-3 p-4">
          <p className="font-semibold">Back-up maken</p>
          <p className="text-sm text-muted">
            Alle personen, categorieën, relaties, gebeurtenissen en geschiedenis als één JSON-bestand. Bewaar het op een veilige plek: het bevat persoonsgegevens.
          </p>
          <Button variant="primary" icon={<Download size={16} />} onClick={() => download(`our-network-backup-${todayIso()}.json`, JSON.stringify(buildBackup(s), null, 2), 'application/json')}>
            Back-up downloaden
          </Button>
        </section>

        <section className="card space-y-3 p-4">
          <p className="font-semibold">Exporteren naar Excel</p>
          <p className="text-sm text-muted">Een overzicht van alle {s.persons.length} personen als CSV-bestand (opent in Excel).</p>
          <Button icon={<FileSpreadsheet size={16} />} onClick={() => download(`our-network-personen-${todayIso()}.csv`, personsCsv(s), 'text/csv;charset=utf-8')}>
            Personen exporteren (CSV)
          </Button>
        </section>

        <section className="card space-y-3 p-4">
          <p className="font-semibold">Back-up importeren</p>
          <p className="text-sm text-muted">Zet een eerder gemaakte back-up terug. Bestaande gegevens blijven behouden; er wordt niets verwijderd.</p>
          <Button icon={<FileUp size={16} />} loading={busy} onClick={() => input.current?.click()}>
            Bestand kiezen
          </Button>
          <input
            ref={input}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void doImport(f);
            }}
          />
          {msg && (
            <p role="status" className={`text-sm ${msg.ok ? 'text-accent' : 'text-danger'}`}>
              {msg.text}
            </p>
          )}
        </section>

        <section className="card space-y-2 p-4">
          <p className="flex items-center gap-2 font-semibold">
            <Image size={17} /> Foto-opslag
          </p>
          <p className="text-sm text-muted">
            {photoCount} herinneringsfoto's en {avatarCount} profielfoto's staan in een privé-opslag (Supabase Storage). Ze worden verkleind opgeslagen (max. 1600 px) en zijn enkel zichtbaar
            voor jullie twee, via links die na een uur verlopen. De back-up bevat de verwijzingen, niet de foto's zelf.
          </p>
        </section>
      </div>
      {dialog}
    </div>
  );
}
