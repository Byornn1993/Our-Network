import { useRef, useState } from 'react';
import { Download, FileSpreadsheet, FileUp, Image } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useStore } from '@/lib/db/store';
import { buildFullBackup, download, importBackup, personsCsv } from '@/lib/backup';
import { Toggle } from '@/components/ui/Form';
import { todayIso } from '@/domain/dates';
import { isArtifactMode } from '@/lib/backend';

export default function DataSettings() {
  const s = useStore();
  const { confirm, dialog } = useConfirm();
  const input = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [overwrite, setOverwrite] = useState(false);
  const photoCount = s.event_photos.length;
  const avatarCount = s.persons.filter((p) => p.avatar_path).length + s.profiles.filter((p) => p.avatar_path).length;

  const exportFile = async (filename: string, content: string, type: string) => {
    setMsg(null);
    try {
      await download(filename, content, type);
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code !== 'declined') setMsg({ ok: false, text: `Exporteren lukte niet${code ? ` (${code})` : ''}.` });
    }
  };

  const exportBackup = async () => {
    setExporting(true);
    setMsg(null);
    try {
      const { backup, missing } = await buildFullBackup(s);
      await exportFile(`our-network-backup-${todayIso()}.json`, JSON.stringify(backup), 'application/json');
      if (missing) setMsg({ ok: false, text: `${missing} foto('s) konden niet geladen worden en zitten niet in de back-up.` });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      setExporting(false);
    }
  };

  const doImport = async (file: File) => {
    const ok = await confirm({
      title: 'Back-up importeren?',
      message: overwrite
        ? 'Alles uit de back-up wordt overgenomen, ook waar de app iets nieuwers heeft. Er wordt niets verwijderd. Dit gaat ook naar de server en het andere toestel.'
        : 'De back-up wordt samengevoegd met jullie huidige netwerk. Nieuwere gegevens in de app worden niet overschreven. Dit wordt ook naar de server en het andere toestel gestuurd.',
      confirmLabel: 'Importeren',
    });
    if (!ok) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await importBackup(s, await file.text(), { overwrite });
      setMsg({ ok: true, text: `Klaar: ${r.added} toegevoegd, ${r.updated} bijgewerkt, ${r.skipped} ongewijzigd, ${r.photos} foto's opgeslagen.` });
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
            Alle personen, categorieën, relaties, gebeurtenissen, geschiedenis én foto's als één JSON-bestand. Bewaar het op een veilige plek: het bevat persoonsgegevens.
          </p>
          {isArtifactMode && (
            <p className="rounded-lg bg-primary-soft p-2 text-sm">
              Overstappen naar de app? Download hier de back-up en importeer ze in de app met <strong>Back-up gaat voor</strong> aan.
            </p>
          )}
          <Button variant="primary" icon={<Download size={16} />} loading={exporting} onClick={() => void exportBackup()}>
            Back-up downloaden
          </Button>
        </section>

        <section className="card space-y-3 p-4">
          <p className="font-semibold">Exporteren naar Excel</p>
          <p className="text-sm text-muted">Een overzicht van alle {s.persons.length} personen als CSV-bestand (opent in Excel).</p>
          <Button icon={<FileSpreadsheet size={16} />} onClick={() => exportFile(`our-network-personen-${todayIso()}.csv`, personsCsv(s), 'text/csv;charset=utf-8')}>
            Personen exporteren (CSV)
          </Button>
        </section>

        <section className="card space-y-3 p-4">
          <p className="font-semibold">Back-up importeren</p>
          <p className="text-sm text-muted">Zet een eerder gemaakte back-up terug. Bestaande gegevens blijven behouden; er wordt niets verwijderd.</p>
          <Toggle
            checked={overwrite}
            onChange={setOverwrite}
            label="Back-up gaat voor"
            hint="Neemt alles uit de back-up over, ook als hier iets nieuwer is. Gebruik dit bij het overzetten vanuit de artifact."
          />
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
            {photoCount} herinneringsfoto's en {avatarCount} profielfoto's staan in een privé-opslag ({isArtifactMode ? 'opslag van de artifact' : 'Supabase Storage'}). Ze worden verkleind opgeslagen (max. 1600 px) en zijn enkel zichtbaar
            voor jullie twee, via links die na een uur verlopen. De back-up bevat ook de foto's zelf.
          </p>
        </section>
      </div>
      {dialog}
    </div>
  );
}
