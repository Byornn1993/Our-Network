import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { AuthScreen } from '@/features/auth/LoginPage';
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
const NetworkPage = lazy(() => import('@/features/network/NetworkPage'));
const PersonsPage = lazy(() => import('@/features/persons/PersonsPage'));
const PersonPage = lazy(() => import('@/features/persons/PersonPage'));
const PersonFormPage = lazy(() => import('@/features/persons/PersonFormPage'));
const StoryPage = lazy(() => import('@/features/story/StoryPage'));
const EventPage = lazy(() => import('@/features/story/EventPage'));
const EventFormPage = lazy(() => import('@/features/story/EventFormPage'));
const YearReviewPage = lazy(() => import('@/features/story/YearReviewPage'));
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'));
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'));
const ProfilesSettings = lazy(() => import('@/features/settings/ProfilesSettings'));
const CategoriesSettings = lazy(() => import('@/features/settings/CategoriesSettings'));
const EventTypesSettings = lazy(() => import('@/features/settings/EventTypesSettings'));
const AccessSettings = lazy(() => import('@/features/settings/AccessSettings'));
const DataSettings = lazy(() => import('@/features/settings/DataSettings'));
const SyncPage = lazy(() => import('@/features/settings/SyncPage'));

/** Bij de allereerste start op een toestel: wachten tot de standaardcategorieën binnen zijn. */
function FirstSyncGate() {
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

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
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
    </BrowserRouter>
  );
}
