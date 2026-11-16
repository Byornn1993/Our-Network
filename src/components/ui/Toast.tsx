import { useEffect, useState } from 'react';

// Korte melding onderaan het scherm (bv. "Bewaard ✓"), eventueel met één actie zoals "Ongedaan maken".
// Eén tegelijk; een nieuwe melding vervangt de vorige.

interface ToastAction {
  label: string;
  onClick: () => void;
}

let listener: ((text: string, action?: ToastAction) => void) | null = null;

export function toast(text: string, action?: ToastAction) {
  listener?.(text, action);
}

export function Toaster() {
  const [msg, setMsg] = useState<{ text: string; action?: ToastAction; n: number } | null>(null);
  useEffect(() => {
    listener = (text, action) => setMsg((m) => ({ text, action, n: (m?.n ?? 0) + 1 }));
    return () => {
      listener = null;
    };
  }, []);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), msg.action ? 6000 : 1800);
    return () => clearTimeout(t);
  }, [msg]);
  if (!msg) return null;
  return (
    <div
      key={msg.n}
      role="status"
      className={`anim-fade-up fixed inset-x-0 z-[80] mx-auto flex w-fit max-w-[92vw] items-center gap-3 rounded-full border border-border bg-surface-2 py-2 pl-4 text-sm text-text shadow-lg ${msg.action ? 'pr-1.5' : 'pointer-events-none pr-4'}`}
      style={{ bottom: 'calc(var(--nav-h) + var(--safe-bottom) + 12px)' }}
    >
      <span>{msg.text}</span>
      {msg.action && (
        <button
          type="button"
          className="min-h-[36px] rounded-full px-3 font-semibold text-accent hover:bg-champ/[.07]"
          onClick={() => {
            msg.action!.onClick();
            setMsg(null);
          }}
        >
          {msg.action.label}
        </button>
      )}
    </div>
  );
}
