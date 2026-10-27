import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  BookHeart,
  ChevronRight,
  Database,
  Image,
  Info,
  KeyRound,
  LogOut,
  Monitor,
  Moon,
  Palette,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Sun,
  Tags,
  User,
  Users,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Segmented, Toggle } from '@/components/ui/Form';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useSyncLabel } from '@/components/layout/SyncIndicator';
import { Avatar } from '@/components/Avatar';
import { useStore } from '@/lib/db/store';
import { usePref } from '@/lib/prefs';
import { resetPositions } from '@/lib/actions';
import { useAuth } from '@/features/auth/AuthProvider';
import { isLocalMode } from '@/lib/backend';

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="section-title">{title}</h2>
      <div className="card divide-y divide-border overflow-hidden">{children}</div>
    </section>
  );
}

function Row({ to, onClick, icon, label, hint, danger, right }: { to?: string; onClick?: () => void; icon: ReactNode; label: ReactNode; hint?: ReactNode; danger?: boolean; right?: ReactNode }) {
  const inner = (
    <>
      <span className={danger ? 'text-danger' : 'text-accent'}>{icon}</span>
      <span className="min-w-0 flex-1 text-left">
        <span className={`block text-[15px] ${danger ? 'text-danger' : ''}`}>{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
      {right ?? (to || onClick ? <ChevronRight size={18} className="text-faint" /> : null)}
    </>
  );
  const cls = 'flex min-h-[56px] w-full items-center gap-3 px-4 py-2 transition hover:bg-surface';
  if (to)
    return (
      <Link to={to} className={cls}>
        {inner}
      </Link>
    );
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={cls}>
        {inner}
      </button>
    );
  return <div className={cls}>{inner}</div>;
}

function useInstallHint(): string {
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone;
  if (standalone) return 'Geïnstalleerd als app op dit toestel ✓';
  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) return 'Safari › Deel-knop › “Zet op beginscherm”';
  if (/android/i.test(navigator.userAgent)) return 'Chrome › menu ⋮ › “App installeren”';
  return 'Chrome/Edge › installeericoon rechts in de adresbalk';
}

export default function SettingsPage() {
  const s = useStore();
  const { user, signOut } = useAuth();
  const { confirm, dialog } = useConfirm();
  const [theme, setTheme] = usePref('theme');
  const [showRelations, setShowRelations] = usePref('mapShowRelations');
  const [showLabels, setShowLabels] = usePref('mapShowLabels');
  const [showChanges, setShowChanges] = usePref('storyShowChanges');
  const [defaultWho, setDefaultWho] = usePref('storyDefaultWho');
  const [msg, setMsg] = useState<string | null>(null);
  const install = useInstallHint();
  const syncLabel = useSyncLabel();
  const privateCount = s.events.filter((e) => e.is_private).length;

  const logout = async () => {
    const r = await signOut();
    if (r.pending > 0) {
      const ok = await confirm({
        title: 'Niet alles is verstuurd',
        message: `${r.pending} wijziging(en) staan nog enkel op dit toestel (offline?). Als je nu uitlogt, gaan ze verloren. Maak eerst verbinding en wacht tot alles gesynchroniseerd is.`,
        confirmLabel: 'Toch uitloggen',
        danger: true,
      });
      if (ok) await signOut({ force: true });
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 pb-10 md:px-0">
      <PageHeader title="Instellingen" />
      <div className="mt-2 space-y-6">
        <Group title="Profielen">
          {s.profiles.map((p) => (
            <Row key={p.id} to="/instellingen/profielen" icon={<Avatar path={p.avatar_path} name={p.name} size={28} ring={false} />} label={`${p.name} beheren`} hint="Naam en profielfoto" />
          ))}
        </Group>

        <Group title="Netwerk">
          <Row to="/instellingen/categorieen" icon={<Palette size={19} />} label="Categorieën en kleuren" hint={`${s.categories.filter((c) => !c.archived_at).length} categorieën · ring, kleur, icoon`} />
          <div className="space-y-3 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Standaardweergave kaart</p>
            <Toggle checked={showLabels} onChange={setShowLabels} label="Namen tonen" />
            <Toggle checked={showRelations} onChange={setShowRelations} label="Onderlinge relaties tonen" hint="Stippellijnen tussen personen die elkaar kennen" />
          </div>
          <Row
            onClick={async () => {
              if (!s.network_positions.length) return setMsg('Er zijn geen handmatige posities.');
              if (await confirm({ title: 'Positionering resetten?', message: 'Iedereen krijgt weer een automatische plaats op de kaart (ook op het andere toestel).', confirmLabel: 'Resetten' })) {
                await resetPositions(s);
                setMsg('Posities gereset.');
              }
            }}
            icon={<RotateCcw size={19} />}
            label="Positionering resetten"
            hint={`${s.network_positions.length} handmatig geplaatst`}
          />
        </Group>

        <Group title="Our Story">
          <div className="space-y-3 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Standaard tijdlijnweergave</p>
            <Segmented
              size="sm"
              value={defaultWho}
              onChange={setDefaultWho}
              options={[
                { value: 'all', label: 'Alles' },
                { value: 'bjorn', label: s.profiles[0]?.name ?? 'Bjorn' },
                { value: 'stephanie', label: s.profiles[1]?.name ?? 'Stephanie' },
                { value: 'common', label: 'Samen' },
              ]}
            />
            <Toggle checked={showChanges} onChange={setShowChanges} label="Relatiewijzigingen in de tijdlijn" />
          </div>
          <Row to="/instellingen/gebeurtenistypes" icon={<Tags size={19} />} label="Gebeurteniscategorieën" hint={`${s.event_categories.filter((c) => !c.archived_at).length} types`} />
          <Row
            icon={<ShieldCheck size={19} />}
            label="Privacy van herinneringen"
            hint={`Een moment op “Privé” zetten maakt het enkel zichtbaar voor wie het aanmaakte (afgedwongen door de database). Jij hebt ${privateCount} privé-moment${privateCount === 1 ? '' : 'en'}.`}
          />
          <Row
            to="/instellingen/gegevens"
            icon={<Image size={19} />}
            label="Foto-opslag"
            hint={`${s.event_photos.length} foto's in een privé-opslag (Supabase Storage), enkel voor jullie twee`}
          />
        </Group>

        <Group title="Weergave">
          <div className="px-4 py-3">
            <Segmented
              value={theme}
              onChange={setTheme}
              options={[
                {
                  value: 'dark',
                  label: (
                    <span className="flex items-center justify-center gap-1.5">
                      <Moon size={14} /> Donker
                    </span>
                  ),
                },
                {
                  value: 'light',
                  label: (
                    <span className="flex items-center justify-center gap-1.5">
                      <Sun size={14} /> Licht
                    </span>
                  ),
                },
                {
                  value: 'auto',
                  label: (
                    <span className="flex items-center justify-center gap-1.5">
                      <Monitor size={14} /> Auto
                    </span>
                  ),
                },
              ]}
            />
          </div>
        </Group>

        <Group title="Gegevens">
          <Row to="/instellingen/gegevens" icon={<Database size={19} />} label="Exporteren, importeren en back-up" hint="JSON-back-up, CSV voor Excel" />
          <Row to="/personen" icon={<Users size={19} />} label="Personen beheren" hint={`${s.persons.length} personen`} />
          <Row to="/story" icon={<BookHeart size={19} />} label="Gebeurtenissen beheren" hint={`${s.events.length} momenten`} />
          <Row to="/instellingen/sync" icon={<RefreshCw size={19} />} label="Synchronisatie" hint={syncLabel.text} />
        </Group>

        <Group title="Applicatie">
          <Row to="/instellingen/toegang" icon={<KeyRound size={19} />} label="Toegang" hint="Wie mag in deze netwerkruimte" />
          <Row icon={<Smartphone size={19} />} label="Installeren als app" hint={install} />
          <Row
            icon={<Info size={19} />}
            label="Privacy"
            hint="Jullie gegevens staan in jullie eigen Supabase-project (EU) met Row Level Security. Op dit toestel staat een lokale kopie die bij uitloggen gewist wordt."
          />
          <Row icon={<User size={19} />} label={user?.email ?? ''} hint={`Our Network v${__APP_VERSION__}${isLocalMode ? ' · lokale testmodus' : ''}`} />
          <Row onClick={() => void logout()} icon={<LogOut size={19} />} label="Uitloggen" danger />
        </Group>
        {msg && (
          <p role="status" className="text-center text-sm text-muted">
            {msg}
          </p>
        )}
      </div>
      {dialog}
    </div>
  );
}
