import type { ReactNode } from 'react';

// Bouwstenen van het profiel van een persoon.

export function InfoRow({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 py-2.5">
      <span className="mt-0.5 text-muted">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted">{label}</p>
        <div className="whitespace-pre-line break-words text-[15px]">{children}</div>
      </div>
    </div>
  );
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="card p-4">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
