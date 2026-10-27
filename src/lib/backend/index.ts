import type { Backend } from './types';
import { createSupabaseBackend } from './supabase';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/** `npm run dev:local` (mode "devlocal"): volledig lokale nabootsing, zonder Supabase. */
export const isLocalMode = import.meta.env.MODE === 'devlocal';

let backend: Backend | null = null;

/**
 * Laadt de backend. In productie verdwijnt de lokale tak volledig uit de bundel
 * (import.meta.env.MODE is daar statisch "production").
 */
export async function loadBackend(): Promise<Backend | null> {
  if (backend) return backend;
  if (import.meta.env.MODE === 'devlocal') {
    const { createLocalBackend } = await import('./local');
    backend = createLocalBackend();
  } else if (url && key) {
    backend = createSupabaseBackend(url, key);
  }
  return backend;
}

export function getBackend(): Backend {
  if (!backend) throw new Error('Backend niet geladen.');
  return backend;
}

export type { Backend } from './types';
