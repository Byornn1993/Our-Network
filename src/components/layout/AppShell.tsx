import { Suspense, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BookHeart, CalendarPlus, LayoutDashboard, Link2, Network, Plus, Settings, Tag, UserPlus, Users } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { ErrorBoundary, Spinner } from '@/components/ui/States';
import { Sheet } from '@/components/ui/Sheet';
import { SyncIndicator } from './SyncIndicator';
import { useSyncStatus } from '@/lib/sync/status';
import { RelationshipSheet } from '@/features/persons/RelationshipSheet';
import { isReadOnly } from '@/lib/backend';
import { ThemeButton } from './ThemeButton';
import { Toaster } from '@/components/ui/Toast';

const MOBILE_NAV = [
  { to: '/netwerk', label: 'Netwerk', icon: Network },
  { to: '/personen', label: 'Personen', icon: Users },
] as const;

const SIDE_NAV = [
  { to: '/netwerk', label: 'Netwerk', icon: Network },
  { to: '/personen', label: 'Personen', icon: Users },
  { to: '/story', label: 'Our Story', icon: BookHeart },
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
] as const;

/** Compact menu achter "+ Toevoegen". */
export function AddMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [relation, setRelation] = useState(false);
  const go = (to: string) => {
    onClose();
    navigate(to);
  };
  const items = [
    { label: 'Nieuwe persoon', hint: 'Iemand toevoegen aan ons netwerk', icon: UserPlus, onClick: () => go('/personen/nieuw') },
    { label: 'Nieuwe gebeurtenis', hint: 'Een moment voor Our Story', icon: CalendarPlus, onClick: () => go('/story/nieuw') },
    { label: 'Nieuwe relatie', hint: 'Twee personen met elkaar verbinden', icon: Link2, onClick: () => (onClose(), setRelation(true)) },
    { label: 'Nieuwe categorie', hint: 'Bv. schoonfamilie of een vriendengroep', icon: Tag, onClick: () => go('/instellingen/categorieen?nieuw=1') },
  ];
  return (
    <>
      <Sheet open={open} onClose={onClose} title="Toevoegen">
        <div className="grid grid-cols-2 gap-2 p-3">
          {items.map((it) => (
            <button key={it.label} type="button" onClick={it.onClick} className="card flex min-h-[96px] flex-col items-start gap-2 p-3 text-left transition duration-150 hover:border-accent/60">
              <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary-soft text-accent">
                <it.icon size={19} />
              </span>
              <span>
                <span className="block text-sm font-semibold">{it.label}</span>
                <span className="block text-xs text-muted">{it.hint}</span>
              </span>
            </button>
          ))}
        </div>
      </Sheet>
      <RelationshipSheet open={relation} onClose={() => setRelation(false)} />
    </>
  );
}

function SideLink({ to, label, icon: Icon }: { to: string; label: string; icon: typeof Users }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `group flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm font-medium transition duration-150 md:flex-col md:justify-center md:gap-1 md:px-1 md:py-2 md:text-[11px] lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:text-sm ${
          isActive ? 'bg-primary-soft text-text shadow-[inset_3px_0_0_var(--accent)]' : 'text-muted hover:bg-champ/[.07] hover:text-text'
        }`
      }
    >
      <Icon size={20} className="group-aria-[current=page]:text-accent" />
      <span>{label}</span>
    </NavLink>
  );
}

function BottomLink({ to, label, icon: Icon }: { to: string; label: string; icon: typeof Users }) {
  return (
    <NavLink to={to} className={({ isActive }) => `group flex min-h-[48px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${isActive ? 'text-text' : 'text-muted'}`}>
      <Icon size={22} className="group-aria-[current=page]:text-accent" />
      {label}
    </NavLink>
  );
}

export function AppShell({ children }: { children?: ReactNode }) {
  const location = useLocation();
  const sync = useSyncStatus();
  const [addOpen, setAddOpen] = useState(false);
  const fullBleed = location.pathname === '/netwerk';

  return (
    <div className="min-h-[var(--app-h)] md:flex" style={{ paddingLeft: 'var(--safe-left)', paddingRight: 'var(--safe-right)' }}>
      {/* Zijbalk: rail op tablet, volledige zijbalk op desktop */}
      <aside className="sticky top-0 z-20 hidden h-dvh shrink-0 flex-col border-r border-line-2 bg-side px-2 py-4 md:flex md:w-[88px] lg:w-[244px] lg:px-4">
        <div className="mb-6 flex items-center gap-3 px-1 md:justify-center lg:justify-start">
          <Logo size={38} />
          <div className="hidden lg:block">
            <p className="font-bold leading-tight">Our Network</p>
            <p className="text-[11px] text-muted">Onze mensen. Ons verhaal.</p>
          </div>
        </div>
        <nav className="flex flex-col gap-1" aria-label="Hoofdnavigatie">
          {SIDE_NAV.map((n) => (
            <SideLink key={n.to} {...n} />
          ))}
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="mt-2 flex min-h-[44px] items-center gap-3 rounded-xl bg-accent px-3 text-sm font-semibold text-accent-ink transition duration-150 hover:bg-[color-mix(in_srgb,var(--accent)_88%,white)] md:flex-col md:justify-center md:gap-1 md:px-1 md:py-2 md:text-[11px] lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:text-sm"
          >
            <Plus size={20} />
            Toevoegen
          </button>
        </nav>
        <div className="mt-auto flex flex-col gap-2">
          <SyncIndicator />
          <ThemeButton className="px-3 md:justify-center md:px-1 lg:justify-start lg:px-3" labelClassName="md:hidden lg:inline" />
          <SideLink to="/instellingen" label="Instellingen" icon={Settings} />
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="safe-top-spacer md:hidden" style={{ paddingTop: 'var(--safe-top)' }} />
        {isReadOnly() && (
          <div className="border-b border-warn/20 bg-warn/10 px-4 py-2 text-center text-xs text-warn" role="status">
            Alleen lezen: je kunt Our Network bekijken, maar niet aanpassen. Vraag Editor-toegang aan de eigenaar.
          </div>
        )}
        {(!sync.online || sync.phase === 'error') && (
          <div className={`flex justify-center border-b md:hidden ${sync.online ? 'border-danger/20 bg-danger/10' : 'border-warn/20 bg-warn/10'}`}>
            <SyncIndicator />
          </div>
        )}
        <main
          className={`mx-auto w-full ${fullBleed ? 'max-w-none' : 'max-w-5xl md:px-8 md:pb-10'}`}
          style={{ paddingBottom: fullBleed ? undefined : 'calc(var(--nav-h) + var(--safe-bottom) + 16px)' }}
        >
          <ErrorBoundary key={location.pathname}>
            <Suspense fallback={<Spinner />}>{children ?? <Outlet />}</Suspense>
          </ErrorBoundary>
        </main>
      </div>

      {/* Onderste navigatie op mobiel: Netwerk · Personen · Toevoegen · Instellingen */}
      <nav
        aria-label="Hoofdnavigatie"
        className="bottom-nav fixed inset-x-0 bottom-0 z-30 flex border-t border-line-2 bg-side md:hidden"
        style={{ paddingBottom: 'var(--safe-bottom)', height: 'calc(var(--nav-h) + var(--safe-bottom))' }}
      >
        {MOBILE_NAV.map((n) => (
          <BottomLink key={n.to} {...n} />
        ))}
        <button type="button" onClick={() => setAddOpen(true)} className="flex min-h-[48px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-ink shadow-[0_4px_14px_-2px_color-mix(in_srgb,var(--accent)_55%,transparent)]">
            <Plus size={18} strokeWidth={2.4} />
          </span>
          Toevoegen
        </button>
        <BottomLink to="/instellingen" label="Instellingen" icon={Settings} />
      </nav>

      <AddMenu open={addOpen} onClose={() => setAddOpen(false)} />
      <Toaster />
    </div>
  );
}
