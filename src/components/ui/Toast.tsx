import { useEffect, useState } from 'react';

// Korte melding onderaan het scherm (bv. na het wisselen van thema). Eén tegelijk.

let listener: ((text: string) => void) | null = null;

export function toast(text: string) {
  listener?.(text);
}

export function Toaster() {
  const [msg, setMsg] = useState<{ text: string; n: number } | null>(null);
  useEffect(() => {
    listener = (text) => setMsg((m) => ({ text, n: (m?.n ?? 0) + 1 }));
    return () => {
      listener = null;
    };
  }, []);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 1800);
    return () => clearTimeout(t);
  }, [msg]);
  if (!msg) return null;
  return (
    <div
      key={msg.n}
      role="status"
      className="anim-fade-up pointer-events-none fixed inset-x-0 z-[80] mx-auto w-fit max-w-[90vw] rounded-full border border-border bg-card px-4 py-2 text-sm text-text shadow-lg"
      style={{ bottom: 'calc(var(--nav-h) + var(--safe-bottom) + 12px)' }}
    >
      {msg.text}
    </div>
  );
}
