import type { ReactNode } from 'react';
import { Logo } from '@/components/Logo';

/** Schermkader voor inloggen, nieuw wachtwoord en meldingen vóór de app (logo, titel, gloed). */
export function AuthScreen({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-[var(--app-h)] items-center justify-center overflow-hidden px-5" style={{ paddingTop: 'var(--safe-top)', paddingBottom: 'var(--safe-bottom)' }}>
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
