import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, HashRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { isArtifactMode } from '@/lib/backend';
import { ShieldAlert } from 'lucide-react';
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { AuthScreen } from '@/features/auth/AuthScreen';
import { AppShell } from '@/components/layout/AppShell';
import { Spinner } from '@/components/ui/States';
import { Button } from '@/components/ui/Button';
import { UpdatePrompt } from '@/components/layout/UpdatePrompt';
import { DataProvider, useStore } from '@/lib/db/store';
import { useSyncStatus } from '@/lib/sync/status';
import { requestSync } from '@/lib/sync/scheduler';

// Lazy loading per route
const LoginPage = lazy(() => import('@/features/auth/LoginPage'));
const NewPasswordPage = lazy(() => import('@/features/auth/NewPasswordPage'));
const loadNetworkPage = () => import('@/features/network/NetworkPage');
const NetworkPage = lazy(loadNetworkPage);
const loadPersonsPage = () => import('@/features/persons/PersonsPage');
const PersonsPage = lazy(loadPersonsPage);
const loadPersonPage = () => import('@/features/persons/PersonPage');
const PersonPage = lazy(loadPersonPage);
const loadPersonFormPage = () => import('@/features/persons/PersonFormPage');
const PersonFormPage = lazy(loadPersonFormPage);
const loadStoryPage = () => import('@/features/story/StoryPage');
const StoryPage = lazy(loadStoryPage);
const loadEventPage = () => import('@/features/story/EventPage');
const EventPage = lazy(loadEventPage);
const loadEventFormPage = () => import('@/features/story/EventFormPage');
const EventFormPage = lazy(loadEventFormPage);
const YearReviewPage = lazy(() => import('@/features/story/YearReviewPage'));
const loadDashboardPage = () => import('@/features/dashboard/DashboardPage');
const DashboardPage = lazy(loadDashboardPage);
const loadSettingsPage = () => import('@/features/settings/SettingsPage');
const SettingsPage = lazy(loadSettingsPage);
const ProfilesSettings = lazy(() => import('@/features/settings/ProfilesSettings'));
const CategoriesSettings = lazy(() => import('@/features/settings/CategoriesSettings'));
const EventTypesSettings = lazy(() => import('@/features/settings/EventTypesSettings'));
const AccessSettings = lazy(() => import('@/features/settings/AccessSettings'));
const DataSettings = lazy(() => import('@/features/settings/DataSettings'));
const SyncPage = lazy(() => import('@/features/settings/SyncPage'));

/** Hoofdschermen stil vooraf ophalen kort na het eerste scherm: de eerste tik voelt dan meteen. */
const PREFETCH = [loadNetworkPage, loadPersonsPage, loadPersonPage, loadPersonFormPage, loadStoryPage, loadEventPage, loadEventFormPage, loadDashboardPage, loadSettingsPage];
function usePrefetchPages() {
  useEffect(() => {
    const t = setTimeout(() => PREFETCH.forEach((load) => void load().catch(() => {})), 2500);
    return () => clearTimeout(t);
  }, []);
}

/** Bij de allereerste start op een toestel: wachten tot de standaardcategorieën binnen zijn. */
function FirstSyncGate() {
  usePrefetchPages();
  const s = useStore();
  const sync = useSyncStatus();
  if (s.categories.length > 0 && s.profiles.length > 0) return <Outlet />;
  if (!sync.online)
    return (
      <AuthScreen>
        <div className="card p-4 text-sm text-muted">Je bent offline. De eerste keer op dit toestel heeft Our Network een verbinding nodig om jullie netwerk op te halen.</div>
      </AuthScreen>
    );
  if (sync.phase === 'error')
    return (
      <AuthScreen>
        <div className="card space-y-3 p-4 text-sm">
          <p className="font-semibold text-danger">Ophalen mislukt</p>
          <p className="text-muted">{sync.error}</p>
          <Button block onClick={() => requestSync()}>
            Opnieuw proberen
          </Button>
        </div>
      </AuthScreen>
    );
  return <Spinner label="Jullie netwerk ophalen…" />;
}

function NoAccess() {
  const { user, signOut } = useAuth();
  return (
    <AuthScreen>
      <div className="card space-y-3 p-5 text-sm">
        <ShieldAlert className="text-warn" />
        <p className="font-semibold">Geen toegang</p>
        <p className="text-muted">
          {user?.email} is (nog) geen lid van deze netwerkruimte. Vraag Bjorn of Stephanie om je e-mailadres toe te voegen via Instellingen › Toegang, en log daarna opnieuw in.
        </p>
        <Button block onClick={() => void signOut({ force: true })}>
          Uitloggen
        </Button>
      </div>
    </AuthScreen>
  );
}

function CheckingAccess() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 8000);
    return () => clearTimeout(t);
  }, []);
  if (!slow) return <Spinner label="Toegang controleren…" />;
  return (
    <AuthScreen>
      <div className="card p-4 text-sm text-muted">Toegang kon nog niet gecontroleerd worden. Controleer je verbinding; de app probeert het opnieuw zodra je online bent.</div>
    </AuthScreen>
  );
}

/** Beschermde routes: zonder sessie en lidmaatschap geen lokale database en geen data. */
function Protected() {
  const { user, loading, ready, membership } = useAuth();
  if (loading) return <Spinner label="Our Network laden…" />;
  if (!user) return <Navigate to="/login" replace />;
  if (membership === 'denied') return <NoAccess />;
  if (!ready) return <CheckingAccess />;
  return (
    <DataProvider>
      <AppShell>
        <FirstSyncGate />
      </AppShell>
    </DataProvider>
  );
}

/** In een Artifact bestaan er geen serverpaden: routes in de #hash. Elders gewone paden (GitHub Pages). */
function Router({ children }: { children: React.ReactNode }) {
  return isArtifactMode ? <HashRouter>{children}</HashRouter> : <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>{children}</BrowserRouter>;
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <Suspense fallback={<Spinner />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/nieuw-wachtwoord" element={<NewPasswordPage />} />
            <Route element={<Protected />}>
              <Route index element={<Navigate to="/netwerk" replace />} />
              <Route path="/netwerk" element={<NetworkPage />} />
              <Route path="/personen" element={<PersonsPage />} />
              <Route path="/personen/nieuw" element={<PersonFormPage />} />
              <Route path="/personen/:id" element={<PersonPage />} />
              <Route path="/personen/:id/bewerken" element={<PersonFormPage />} />
              <Route path="/story" element={<StoryPage />} />
              <Route path="/story/nieuw" element={<EventFormPage />} />
              <Route path="/story/jaar/:year" element={<YearReviewPage />} />
              <Route path="/story/:id" element={<EventPage />} />
              <Route path="/story/:id/bewerken" element={<EventFormPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/instellingen" element={<SettingsPage />} />
              <Route path="/instellingen/profielen" element={<ProfilesSettings />} />
              <Route path="/instellingen/categorieen" element={<CategoriesSettings />} />
              <Route path="/instellingen/gebeurtenistypes" element={<EventTypesSettings />} />
              <Route path="/instellingen/toegang" element={<AccessSettings />} />
              <Route path="/instellingen/gegevens" element={<DataSettings />} />
              <Route path="/instellingen/sync" element={<SyncPage />} />
              <Route path="*" element={<Navigate to="/netwerk" replace />} />
            </Route>
          </Routes>
        </Suspense>
        <UpdatePrompt />
      </AuthProvider>
    </Router>
  );
}
