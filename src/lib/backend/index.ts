import type { Backend } from './types';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/** `npm run dev:local` (mode "devlocal"): volledig lokale nabootsing, zonder Supabase. */
export const isLocalMode = import.meta.env.MODE === 'devlocal';
/** `npm run build:artifact` (mode "artifact"): draait als claude.ai-Artifact met de gedeelde Artifact-database. */
export const isArtifactMode = import.meta.env.MODE === 'artifact';

let backend: Backend | null = null;

/**
 * Laadt de backend. De lokale en artifact-takken verdwijnen uit builds van andere modi
 * (import.meta.env.MODE is statisch bekend).
 */
export async function loadBackend(): Promise<Backend | null> {
  if (backend) return backend;
  if (import.meta.env.MODE === 'devlocal') {
    const { createLocalBackend } = await import('./local');
    backend = createLocalBackend();
  } else if (import.meta.env.MODE === 'artifact') {
    const { createArtifactBackend } = await import('./artifact');
    const { getDb } = await import('@/lib/db/schema');
    const claude = (window as unknown as { claude?: { use(name: string): Promise<unknown> } }).claude;
    backend = claude
      ? await createArtifactBackend(claude, {
          localRow: async (table, id) => {
            try {
              return (await getDb().table(table).get(id)) as Record<string, unknown> | undefined;
            } catch {
              return undefined;
            }
          },
        })
      : null;
  } else if (url && key) {
    const { createSupabaseBackend } = await import('./supabase');
    backend = createSupabaseBackend(url, key);
  }
  return backend;
}

/** Mag deze kijker foto's uploaden? (Artifact: enkel eigenaar en Editors.) */
export const canUpload = (): boolean => backend?.permissions?.canUpload ?? true;
/** false = deze kijker mag enkel lezen; null/true = schrijven toegestaan of onbekend. */
export const isReadOnly = (): boolean => backend?.permissions?.canWrite === false;

export function getBackend(): Backend {
  if (!backend) throw new Error('Backend niet geladen.');
  return backend;
}

export type { Backend } from './types';
