import { useState, type FormEvent, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/Logo';
import { isArtifactMode, isLocalMode } from '@/lib/backend';
import { useAuth } from './AuthProvider';

/** Volledig adres van een pagina binnen de app (werkt lokaal én onder /Our-Network/ op GitHub Pages). */
export const appUrl = (path = '') => window.location.origin + import.meta.env.BASE_URL + path;

export function AuthScreen({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-5" style={{ paddingTop: 'var(--safe-top)', paddingBottom: 'var(--safe-bottom)' }}>
      {/* zachte gloed in plaats van een foto */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[18%] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--accent)_22%,transparent),transparent_65%)]" />
        <div className="absolute bottom-[-120px] left-1/2 h-[380px] w-[680px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse,color-mix(in_srgb,var(--c1)_12%,transparent),transparent_65%)]" />
      </div>
      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo size={72} />
          <h1 className="mt-5 text-3xl font-bold tracking-tight">Our Network</h1>
          <p className="mt-2 text-muted">
            Onze mensen. Onze momenten.
            <br />
            Ons verhaal.
          </p>
        </div>
        {children}
        <p className="mt-6 text-center text-xs text-faint">Samen in ons netwerk · privé-app voor Bjorn & Stephanie</p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const { backend, user, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'password' | 'reset'>('password');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!backend) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === 'password') await backend.auth.signIn(email.trim(), password);
      else {
        // De link in de mail opent /nieuw-wachtwoord, waar je een nieuw wachtwoord kiest.
        await backend.auth.sendResetLink(email.trim(), appUrl('nieuw-wachtwoord'));
        setSent(true);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(
        /invalid login/i.test(msg)
          ? 'E-mail of wachtwoord klopt niet.'
          : /rate limit|too many/i.test(msg)
            ? 'Te veel pogingen. Wacht even en probeer opnieuw.'
            : !navigator.onLine
              ? 'Je bent offline. Inloggen vraagt een verbinding.'
              : msg,
      );
    } finally {
      setBusy(false);
    }
  };

  // In de Artifact log je niet apart in: Claude weet wie de pagina bekijkt.
  if (isArtifactMode && !loading)
    return (
      <AuthScreen>
        <div className="card space-y-2 p-4 text-sm text-muted">
          <p className="font-semibold text-text">Open Our Network via Claude</p>
          <p>
            {backend
              ? 'Claude kon niet bepalen wie deze pagina bekijkt. Log in op claude.ai (of open de Claude-app) en open de artifact opnieuw.'
              : 'De gedeelde opslag van deze artifact is hier niet beschikbaar. Open de artifact terwijl je ingelogd bent op claude.ai of in de Claude-app, met een account waarmee hij gedeeld is.'}
          </p>
        </div>
      </AuthScreen>
    );

  if (!loading && !backend)
    return (
      <AuthScreen>
        <div className="card p-4 text-sm text-muted">
          Supabase is niet geconfigureerd. Kopieer <code>.env.example</code> naar <code>.env</code> en vul de URL en publishable key in.
        </div>
      </AuthScreen>
    );

  if (sent)
    return (
      <AuthScreen>
        <div className="card p-5 text-center">
          <Mail className="mx-auto text-accent" />
          <p className="mt-2 font-semibold">Check je mailbox</p>
          <p className="mt-1 text-sm text-muted">We stuurden een link naar {email.trim()} om een nieuw wachtwoord in te stellen. Kijk ook bij spam.</p>
          <button type="button" className="tap mt-3 text-sm text-muted hover:text-text" onClick={() => (setSent(false), setMode('password'))}>
            Terug naar inloggen
          </button>
        </div>
      </AuthScreen>
    );

  return (
    <AuthScreen>
      <form onSubmit={submit} className="card space-y-3 p-4">
        {isLocalMode && <p className="rounded-lg bg-warn/10 p-2 text-xs text-warn">Lokale testmodus: elk e-mailadres met wachtwoord “dev-password”. Er gaat niets naar Supabase.</p>}
        {mode === 'reset' && <p className="text-sm text-muted">Vul je e-mailadres in. Je krijgt een link om een nieuw wachtwoord te kiezen.</p>}
        <label className="block">
          <span className="label">E-mail</span>
          <input className="field mt-1" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        {mode === 'password' && (
          <label className="block">
            <span className="label">Wachtwoord</span>
            <input className="field mt-1" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
        )}
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
            {mode === 'password' && /klopt niet/.test(error) && (
              <span className="mt-1 block text-xs text-muted">Tip: je browser kan het wachtwoord van een andere app (Finance, Be Strong) invullen. Typ het Our Network-wachtwoord zelf.</span>
            )}
          </p>
        )}
        <Button type="submit" variant="primary" size="lg" block loading={busy}>
          {mode === 'password' ? 'Inloggen' : 'Stuur resetlink'}
        </Button>
        <button type="button" className="tap w-full text-sm text-muted hover:text-text" onClick={() => (setMode(mode === 'password' ? 'reset' : 'password'), setError(null))}>
          {mode === 'password' ? 'Wachtwoord vergeten?' : 'Terug naar inloggen'}
        </button>
      </form>
    </AuthScreen>
  );
}
